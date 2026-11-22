import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebaseApp';

let savedPhone = '';

function mapUser(u: any) {
  if (!u) return null;
  return {
    id: u.uid,
    email: u.email || `${u.uid.slice(0, 6)}@shinecaptain.app`,
    phone: u.phoneNumber || savedPhone || '+919999999999',
    user_metadata: { full_name: u.displayName || 'Shine Captain' },
  };
}

class FirestoreQueryBuilder {
  private table: string;
  private filters: Array<{ field: string; value: any }> = [];
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private isSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols = '*') {
    if (this.op !== 'insert' && this.op !== 'upsert' && this.op !== 'update') {
      this.op = 'select';
    }
    return this;
  }

  insert(data: any) {
    this.op = 'insert';
    this.payload = data;
    return this;
  }

  upsert(data: any, _opts?: any) {
    this.op = 'upsert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.op = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value });
    return this;
  }

  in(field: string, values: any[]) {
    if (values && values.length > 0) {
      this.filters.push({ field, value: values });
    }
    return this;
  }

  order(_field: string, _opts?: any) {
    return this;
  }

  limit(_n: number) {
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this.execute();
  }

  single() {
    this.isSingle = true;
    return this.execute();
  }

  then(resolve: any, reject?: any) {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const colRef = collection(db, this.table);

      if (this.op === 'insert' || this.op === 'upsert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved: any[] = [];
        for (const item of items) {
          const docId = item.id || item.driver_id || item.user_id || doc(colRef).id;
          const record = {
            ...item,
            id: docId,
            created_at: item.created_at || new Date().toISOString(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, this.table, docId), record, { merge: true });
          saved.push(record);
        }
        return { data: this.isSingle ? saved : saved, error: null };
      }

      if (this.op === 'update') {
        const idFilter = this.filters.find((f) => f.field === 'id');
        if (idFilter) {
          await updateDoc(doc(db, this.table, idFilter.value), {
            ...this.payload,
            updatedAt: serverTimestamp(),
          });
          return { data: { id: idFilter.value, ...this.payload }, error: null };
        }
        const snap = await getDocs(colRef);
        for (const d of snap.docs) {
          const data = d.data();
          const match = this.filters.every((f) => data[f.field] === f.value);
          if (match) {
            await updateDoc(d.ref, { ...this.payload, updatedAt: serverTimestamp() });
          }
        }
        return { data: this.payload, error: null };
      }

      if (this.op === 'delete') {
        const idFilter = this.filters.find((f) => f.field === 'id');
        if (idFilter) {
          await deleteDoc(doc(db, this.table, idFilter.value));
        }
        return { data: null, error: null };
      }

      const idFilter = this.filters.find((f) => f.field === 'id');
      if (idFilter) {
        const dSnap = await getDoc(doc(db, this.table, idFilter.value));
        const row = dSnap.exists() ? { id: dSnap.id, ...dSnap.data() } : null;
        return { data: this.isSingle ? row : row ? [row] : [], error: null };
      }

      const qConstraints = this.filters.map((f) => where(f.field, '==', f.value));
      const q = qConstraints.length > 0 ? query(colRef, ...qConstraints) : colRef;
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return { data: this.isSingle ? rows || null : rows, error: null };
    } catch (error: any) {
      return { data: this.isSingle ? null : [], error };
    }
  }
}

export function getSupabaseClient(): any {
  const channels: Record<string, () => void> = {};

  return {
    from: (table: string) => new FirestoreQueryBuilder(table),
    storage: {
      from: (bucket: string) => ({
        async upload(path: string, file: Blob | File) {
          try {
            const dataUrl: string = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const res = String(reader.result || "");
                if (!res.startsWith("data:image/")) {
                  resolve(res);
                  return;
                }
                const img = new Image();
                img.onload = () => {
                  const maxDim = 720;
                  let w = img.width || 600;
                  let h = img.height || 600;
                  if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                    else { w = Math.round((w * maxDim) / h); h = maxDim; }
                  }
                  const canvas = document.createElement("canvas");
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
                  if (ctx) ctx.drawImage(img, 0, 0, w, h);
                  resolve(canvas.toDataURL("image/jpeg", 0.72));
                };
                img.onerror = () => resolve(res);
                img.src = res;
              };
              reader.onerror = () => reject(new Error("File read failed"));
              reader.readAsDataURL(file);
            });
            (window as any).__shineUploadedUrls = (window as any).__shineUploadedUrls || {};
            (window as any).__shineUploadedUrls[bucket + "/" + path] = dataUrl;
            return { data: { path }, error: null };
          } catch (error: any) {
            return { data: null, error };
          }
        },
        getPublicUrl(path: string) {
          const map = (window as any).__shineUploadedUrls || {};
          return {
            data: {
              publicUrl: map[bucket + "/" + path] || "",
            },
          };
        },
      }),
    },
    auth: {
      async getUser() {
        await auth.authStateReady();
        const user = mapUser(auth.currentUser);
        return { data: { user }, error: null };
      },
      async getSession() {
        await auth.authStateReady();
        const user = mapUser(auth.currentUser);
        return {
          data: {
            session: user ? { user, access_token: 'firebase-token' } : null,
          },
          error: null,
        };
      },
      onAuthStateChange(cb: (event: string, session: any) => void) {
        const unsub = onAuthStateChanged(auth, (fbUser) => {
          const user = mapUser(fbUser);
          cb(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user, access_token: 'firebase-token' } : null);
        });
        return { data: { subscription: { unsubscribe: unsub } } };
      },
      async signInWithOtp({ phone }: { phone: string }) {
        savedPhone = phone;
        return { data: {}, error: null };
      },
      async verifyOtp({ phone }: { phone: string; token: string }) {
        savedPhone = phone;
        const res = await signInAnonymously(auth);
        const user = mapUser(res.user);
        return { data: { user, session: { user } }, error: null };
      },
      async signOut() {
        await signOut(auth);
        return { error: null };
      },
    },
    channel(name: string) {
      let tableName = 'rides';
      let callback: any = null;
      return {
        on(_type: string, filter: any, cb: any) {
          if (filter?.table) tableName = filter.table;
          callback = cb;
          return this;
        },
        subscribe() {
          const unsub = onSnapshot(collection(db, tableName), (snap) => {
            snap.docChanges().forEach((change) => {
              if (callback) {
                callback({
                  eventType: change.type === 'added' ? 'INSERT' : 'UPDATE',
                  new: { id: change.doc.id, ...change.doc.data() },
                });
              }
            });
          });
          channels[name] = unsub;
          return { name };
        },
      };
    },
    removeChannel(ch: any) {
      if (ch?.name && channels[ch.name]) {
        channels[ch.name]();
        delete channels[ch.name];
      }
    },
  };
}

// Real-Time Incoming Rides & Live Driver GPS Telemetry Bridge
(function initDriverRealtimeBridge() {
  try {
    onSnapshot(collection(db, 'rides'), (snap) => {
      const rides = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      (window as any).__shineDriverLiveRides = rides;
      window.dispatchEvent(new CustomEvent('shine-driver-rides-updated', { detail: rides }));
    });

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.watchPosition(
        async (pos) => {
          const u = auth.currentUser;
          if (!u) return;
          const payload = {
            driver_id: u.uid,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading || 0,
            speed_kmh: pos.coords.speed && pos.coords.speed > 0 ? Math.round(pos.coords.speed * 3.6) : 0,
            is_online: true,
            updated_at: new Date().toISOString(),
          };
          await setDoc(doc(db, 'driver_locations', u.uid), payload, { merge: true }).catch(() => {});
          await setDoc(doc(db, 'drivers', u.uid), { lat: payload.lat, lng: payload.lng, isOnline: true, updated_at: payload.updated_at }, { merge: true }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  } catch {}
})();
onSnapshot(collection(db, 'ride_messages'), (s) => window.dispatchEvent(new CustomEvent('shine-driver-chat-updated', { detail: s.docs.map(d => ({ id: d.id, ...d.data() })) })));

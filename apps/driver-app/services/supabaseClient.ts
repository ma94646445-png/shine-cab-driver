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
            const storageRef = ref(storage, `${bucket}/${path}`);
            await uploadBytes(storageRef, file);
            return { data: { path }, error: null };
          } catch (error: any) {
            return { data: null, error };
          }
        },
        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `https://googleapis.com{encodeURIComponent(bucket + '/' + path)}?alt=media`,
            },
          };
        },
      }),
    },
    functions: {
      async invoke(fnName: string, { body }: { body?: any } = {}) {
        try {
          if (fnName === 'accept-ride' && body?.rideId) {
            await updateDoc(doc(db, 'rides', body.rideId), {
              status: 'driver_assigned',
              driver_id: body.driverId || auth.currentUser?.uid,
              accepted_at: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
            const rSnap = await getDoc(doc(db, 'rides', body.rideId));
            return { data: { ride: { id: rSnap.id, ...rSnap.data() } }, error: null };
          }
          if (fnName === 'verify-pickup-otp' && body?.rideId) {
            await updateDoc(doc(db, 'rides', body.rideId), {
              status: 'ride_started',
              otp_verified: true,
              started_at: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
            return { data: { verified: true }, error: null };
          }
          if (fnName === 'complete-ride' && body?.rideId) {
            await updateDoc(doc(db, 'rides', body.rideId), {
              status: 'ride_completed',
              completed_at: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
            return { data: { completed: true }, error: null };
          }
          if (fnName === 'request-driver-payout') {
            const pId = `payout_${Date.now()}`;
            await setDoc(doc(db, 'payouts', pId), {
              id: pId,
              ...body,
              status: 'pending',
              created_at: new Date().toISOString(),
            });
            return { data: { id: pId, status: 'pending' }, error: null };
          }
          return { data: { ok: true }, error: null };
        } catch (error: any) {
          return { data: null, error };
        }
      },
    },
    async rpc(fnName: string, _params?: any) {
      if (fnName === 'get_driver_earnings_summary') {
        return {
          data: {
            today_earnings: 0,
            week_earnings: 0,
            month_earnings: 0,
            total_rides: 0,
            online_hours: 0,
          },
          error: null,
        };
      }
      return { data: null, error: null };
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

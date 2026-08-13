import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import {
  COLLECTIONS,
  FIELD_LIMITS,
  USER_ROLES,
} from '../../common/constants/index.constants';
import type { UserRole } from '../../common/constants/index.constants';

/**
 * The canonical user. **Pure schema** (house rule 6).
 *
 * It used to carry a `pre('save')` hook that bcrypt-hashed the password and a
 * `comparePassword` instance method. Both are gone, and their removal is not cosmetic:
 *
 *  - A hashing hook makes "is this field plaintext or a digest?" depend on which write
 *    path you came through, which is exactly the ambiguity that produces a double-hashed
 *    password when a service writes an already-hashed value (`rehash-on-login` does
 *    precisely that).
 *  - Hashing policy — algorithm, cost, upgrade rules — is a domain decision, and it now
 *    lives in one auditable place: `password.service.ts`.
 *
 * Every write of `password` therefore stores an already-hashed value, produced by
 * `PasswordService.hash`. The schema no longer knows or cares how.
 */
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  /** An Argon2id (or legacy bcrypt) digest. Absent for social-only accounts. */
  password?: string;
  role: UserRole;
  isVerified: boolean;
  disabled: boolean;
  disabledReason?: string;
  disabledAt?: Date;
  /**
   * Set when the user closes their account. The row is retained as evidence while the
   * account stops being usable — `deletedAt: null` is part of every credential lookup,
   * so nothing here is trusted to a `disabled` flag alone.
   */
  deletedAt?: Date | null;
  /**
   * The address the account held before deletion. `email` is replaced with a tombstone
   * at that point so the live unique index stops reserving the real address; this field
   * is what keeps the audit trail intact. See `DELETED_ACCOUNT`.
   */
  deletedEmail?: string;
  profilePictureUrl: string;
  bio: string;
  jobTitle: string;
  company: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // No `minlength` any more: the constraint belongs on the plaintext DTO, and applying
    // it to a digest was only ever accidentally satisfied by the digest being long.
    password: { type: String, select: false },
    role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.USER },
    isVerified: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false, index: true },
    disabledReason: { type: String, maxlength: FIELD_LIMITS.DISABLED_REASON },
    disabledAt: { type: Date },
    // Explicit `null` default so `{ deletedAt: null }` matches on documents written from
    // now on as well as the ones that predate the field.
    deletedAt: { type: Date, default: null },
    deletedEmail: { type: String, select: false },
    profilePictureUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: FIELD_LIMITS.BIO, default: '' },
    jobTitle: { type: String, trim: true, maxlength: FIELD_LIMITS.JOB_TITLE, default: '' },
    company: { type: String, trim: true, maxlength: FIELD_LIMITS.JOB_TITLE, default: '' },
    country: { type: String, trim: true, maxlength: FIELD_LIMITS.COUNTRY_CODE, default: '' },
  },
  { timestamps: true },
);

// Credential lookups are all `{ email, deletedAt: null }`; the unique index on `email`
// alone cannot serve that as a covered equality match on both fields.
userSchema.index({ email: 1, deletedAt: 1 });

export const User: Model<IUser> =
  (mongoose.models[COLLECTIONS.USER] as Model<IUser>) ||
  mongoose.model<IUser>(COLLECTIONS.USER, userSchema);

export default User;

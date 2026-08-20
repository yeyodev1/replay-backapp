import { Schema, model } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    resetTokenHash: { type: String },
    resetTokenExpires: { type: Date },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema);

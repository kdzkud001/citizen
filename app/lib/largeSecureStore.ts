/**
 * Supabase's session (access + refresh token + metadata) is bigger than
 * expo-secure-store can hold directly -- SecureStore is backed by the iOS
 * Keychain, which is practically capped around 2KB per key. Per Expo's own
 * guide (docs.expo.dev/guides/using-supabase), the fix is to encrypt the
 * session with a random AES key, store that small key in SecureStore, and
 * put the (much larger) encrypted blob in AsyncStorage instead.
 *
 * All three pieces (expo-secure-store, expo-crypto, AsyncStorage) are
 * bundled in Expo Go -- unlike the more commonly-shown react-native-
 * get-random-values, which is a native module Expo Go doesn't include and
 * would force a development build. expo-crypto's getRandomValues covers
 * the same need without that requirement.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// aes-js expects a global crypto.getRandomValues; expo-crypto provides an
// equivalent implementation directly, so we call it rather than polyfill
// the global (avoids pulling in react-native-get-random-values).
function randomBytes(length: number): Uint8Array {
  return Crypto.getRandomValues(new Uint8Array(length));
}

export class LargeSecureStore {
  private async getEncryptionKey(keyName: string): Promise<Uint8Array> {
    const existing = await SecureStore.getItemAsync(keyName);
    if (existing) {
      return aesjs.utils.hex.toBytes(existing);
    }
    const key = randomBytes(32);
    await SecureStore.setItemAsync(keyName, aesjs.utils.hex.fromBytes(key));
    return key;
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const keyName = `${key}-encryption-key`;
    const encryptionKey = await this.getEncryptionKey(keyName);
    const counter = new aesjs.Counter(1);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, counter);
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    const keyName = `${key}-encryption-key`;
    const encryptionKey = await this.getEncryptionKey(keyName);
    const counter = new aesjs.Counter(1);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, counter);
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encryptedBytes));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}-encryption-key`);
  }
}

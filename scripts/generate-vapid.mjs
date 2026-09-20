#!/usr/bin/env node
/**
 * Generates a VAPID key pair for Web Push.
 *
 *   npm run generate:vapid
 *
 * Run once per environment. The public key identifies this server to the push
 * service and ends up in the browser; the private key signs the pushes and must
 * not. Rotating them invalidates every existing subscription — every device
 * would have to grant permission again — so treat them as permanent once staff
 * have enabled notifications.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('Add these to .env.vercel.local and to Vercel (Production):\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:gm@example.hornbach.se`);
console.log('\nThe public key is safe to expose. The private key is not.');

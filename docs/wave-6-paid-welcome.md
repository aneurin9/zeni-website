# Wave 6 — Paid welcome personalization

The paid welcome page now personalizes its heading only after the existing opaque Stripe Checkout Session ID is verified server-side.

## Flow

1. Stripe redirects to `/welcome/?checkout_session_id={CHECKOUT_SESSION_ID}`.
2. The browser removes the session ID from the visible URL immediately and asks the same-origin `/api/welcome` bridge for verified personalization.
3. The website bridge signs a server-to-server request using the existing checkout bridge secret.
4. The backend verifies the signature, Stripe session, and linked pending signup before returning only a sanitized first name.
5. If any verification step fails, the page keeps the generic “You’re all set” heading and remains fully usable.

No customer name is accepted from a public query parameter.

Webhook Authentication: HMAC-SHA256 Explained
1. Objective

This experiment demonstrates how to authenticate GitHub webhook deliveries using HMAC-SHA256.

We will explore:

Why a publicly accessible webhook endpoint cannot trust incoming requests.
How HMAC-SHA256 works.
How GitHub signs webhook payloads.
How Express verifies the signature.
Why the original request body matters.
How to reject forged requests.
Common implementation mistakes.

Project: ActualWebhook
Stack: Node.js, Express, GitHub Webhooks, ngrok
Authentication mechanism: HMAC-SHA256

2. The security problem

Initially, our Express endpoint accepted incoming requests without checking their authenticity.

An attacker could send a request using Postman:

POST /webhook/github HTTP/1.1
Content-Type: application/json
X-GitHub-Event: push
X-GitHub-Delivery: fake-delivery-123

With this body:

{
  "ref": "refs/heads/master",
  "repository": {
    "name": "ActualWebhook"
  },
  "commits": [
    {
      "message": "Fake commit"
    }
  ]
}

The request resembles a genuine GitHub event, but its contents alone do not prove that GitHub sent it.

Our original endpoint could accept this request because it did not authenticate the sender.

Key lesson

A valid JSON payload is not proof of authenticity. HTTP headers supplied by the sender are not proof either.

We need a way to verify the request cryptographically.

3. What is HMAC-SHA256?

HMAC stands for Hash-based Message Authentication Code.

It combines a secret key with a cryptographic hash function to produce a message authentication code.

SHA-256 is the underlying hash function used in HMAC-SHA256.

SHA-256 produces a 256-bit digest:

256 bits / 8 = 32 bytes

When represented in hexadecimal:

32 bytes × 2 hexadecimal characters = 64 characters

Therefore, an HMAC-SHA256 result is 32 bytes, or 64 hexadecimal characters when encoded as hex.

Conceptual model
                  Sender
                     |
             Original payload
                     |
                     v
          HMAC-SHA256(secret, body)
                     |
                     v
              Signature
                     |
                     v
          Send body + signature
                     |
                     v
                  Receiver
                     |
             Original body bytes
                     |
                     v
          HMAC-SHA256(secret, body)
                     |
                     v
             Expected signature
                     |
                     v
             Compare signatures
                     |
              +------+------+
              |             |
            Match         Mismatch
              |             |
              v             v
        Authenticate      Reject

The sender and receiver must have the same secret.

The secret itself is not transmitted as part of the signature header.

What HMAC provides
Authentication evidence based on possession of the shared secret.
Integrity protection for the signed content.
What HMAC does not provide
Encryption.
Automatic replay prevention.
Authorization for every business operation.
Protection if the signing secret is compromised.
4. How GitHub signs webhook requests

GitHub sends the signature in this header:

X-Hub-Signature-256: sha256=<hexadecimal-signature>

The signature is calculated using HMAC-SHA256 and the configured webhook secret.

The receiver must independently calculate the expected signature using the same secret and the exact payload bytes.

Official documentation: Validating webhook deliveries.

5. Configure the webhook secret

Generate a random secret using Node.js:

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Configure that secret in:

GitHub repository → Settings → Webhooks → Your webhook → Edit → Secret

Store the same value in your local .env file:

secretkey=replace_with_your_generated_secret

The variable name must match the code:

const webhook_secret = process.env.secretkey;

Ensure .env is included in .gitignore:

.env
node_modules/

Never commit the actual secret to GitHub.

If a secret has already been exposed, rotate it.

6. Implement signature verification

The following is the essential verification logic used in our Express application.

const crypto = require("crypto");

function verifyGithubSignature(req, res, next) {
    const signature = req.get("X-Hub-Signature-256");

    // 1. Check signature format.
    if (
        typeof signature !== "string" ||
        !/^sha256=[0-9a-f]{64}$/i.test(signature)
    ) {
        return res.status(401).send("Missing or malformed signature");
    }

    // 2. Ensure the original request body is available.
    if (!Buffer.isBuffer(req.body)) {
        return res.status(500).send("Raw request body unavailable");
    }

    // 3. Calculate the expected HMAC.
    const expectedSignature =
        "sha256=" +
        crypto
            .createHmac("sha256", process.env.secretkey)
            .update(req.body)
            .digest("hex");

    // 4. Convert signatures to buffers.
    const receivedBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    // 5. Compare safely.
    if (
        receivedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
        return res.status(401).send("Invalid signature");
    }

    // 6. Continue only after successful verification.
    next();
}

This snippet assumes that the secret is configured and checked at application startup, as in our main server.

Step 1: Validate the format
/^sha256=[0-9a-f]{64}$/i.test(signature)

This checks that the signature has the expected structure.

It does not prove that the signature is genuine.

Step 2: Preserve the raw request body
Buffer.isBuffer(req.body)

This confirms that the body is represented as a Buffer.

We need the original request bytes because GitHub signs the payload, not an abstract JavaScript object.

Step 3: Calculate the expected signature
crypto
    .createHmac("sha256", process.env.secretkey)
    .update(req.body)
    .digest("hex");

The inputs are:

Input	Purpose
"sha256"	Selects the HMAC algorithm
process.env.secretkey	Shared secret
req.body	Original payload bytes
"hex"	Encodes the output as hexadecimal

The result contains 64 hexadecimal characters. We prepend sha256= to match GitHub's header format.

Step 4: Compare safely
crypto.timingSafeEqual(receivedBuffer, expectedBuffer)

This compares equal-length buffers using a timing-safe comparison function.

The preceding length check is necessary because timingSafeEqual() requires both buffers to have equal lengths.

Step 5: Continue only when authenticated
next();

If verification fails, the middleware returns an error instead of continuing to the webhook handler.

7. Preserve the original request body

Our webhook route uses:

app.post(
    "/webhook/github",
    express.raw({ type: "application/json" }),
    verifyGithubSignature,
    webhookHandler
);

The express.raw() middleware provides the request body as a Buffer.

For this route, ensure a preceding middleware hasn't already parsed the request body.

Consider these JSON documents:

{"name":"ActualWebhook"}
{
  "name": "ActualWebhook"
}

Both represent the same logical object, but their original bytes differ.

HMAC operates on bytes. Consequently, the signatures calculated from those two byte sequences differ.

Lesson: Verify the signature against the original body bytes before parsing or modifying the payload.

8. Experiments and expected results

We tested the endpoint using GitHub, ngrok, and Postman.

Experiment A: Genuine GitHub event

Action: Push a commit to the repository.

Expected result:

Event: push
Authenticated GitHub event
HTTP 200 OK

The application authenticates the signature before processing the payload.

Experiment B: Missing signature

Action: Send a JSON request using Postman without the X-Hub-Signature-256 header.

Expected result:

HTTP/1.1 401 Unauthorized

Reason: The request does not contain a validly formatted signature header.

Experiment C: Fake signature

Action: Send a signature-shaped string containing 64 hexadecimal characters, but not a correctly calculated HMAC.

Expected result:

HTTP/1.1 401 Unauthorized

Reason: The signature's format is valid, but its value doesn't match the expected HMAC.

Experiment D: Modified payload

Action: Modify a genuine payload without recalculating a valid signature.

Expected result:

HTTP/1.1 401 Unauthorized

Reason: The modified body produces a different HMAC.

Experiment E: Wrong secret

Action: Configure the application with a different secret from the one used by GitHub.

Expected result:

HTTP/1.1 401 Unauthorized

Reason: The application calculates a different signature.

Testing note: These are expected outcomes, not claims that every experiment has already passed. Record the actual results in the repository after running them.

9. Common implementation mistakes
Mistake	Why it matters
Trusting X-GitHub-Event without verifying the signature	The header can be forged
Trusting X-GitHub-Delivery as proof of authenticity	The delivery ID isn't a cryptographic signature
Using a different secret	The expected HMAC won't match
Verifying a parsed and re-serialized body	The bytes can differ from the signed payload
Comparing only the signature's format	A correctly formatted signature can still be fake
Using ordinary string comparison	It doesn't provide the timing-safe comparison behavior we want
Forgetting return after an error response	Execution can continue after the response has been sent
Committing .env	The signing secret may be exposed
Assuming HMAC prevents duplicate processing	A valid request can be delivered or replayed more than once
10. Limitations and next steps

HMAC verification is only one part of a secure and reliable webhook receiver.

The current project still needs:

Replay and duplicate-delivery protection.
Idempotent processing.
Durable event storage.
Correct acknowledgment behavior.
Retry and failure-recovery mechanisms.
Authorization and business-rule validation.
Monitoring and operational logging.

A valid signature does not guarantee that the event is new, authorized, or safely processed.

These concerns will be addressed in subsequent experiments.

11. Key takeaways
HMAC-SHA256 authenticates signed content using a shared secret.
SHA-256 produces a 256-bit digest, represented by 64 hexadecimal characters.
GitHub provides the signature in X-Hub-Signature-256.
The receiver independently calculates the expected HMAC.
Signature verification must use the original request-body bytes.
Signature format validation is not the same as cryptographic verification.
crypto.timingSafeEqual() provides a safer comparison for equal-length buffers.
HMAC does not encrypt the payload or automatically prevent replay attacks.
The secret must be kept confidential.
Authentication must be combined with durable processing and idempotency for reliability.

Next topic: Exactly what is signed and the raw-body trap.
// Ambient declaration so the API typechecks before `smile-identity-core` is
// installed. The KYC live path dynamically imports this SDK; in sandbox/testing
// (no keys configured) it is never loaded, so the dependency is optional at
// build time. Once installed, the package's own types take over.
declare module 'smile-identity-core';

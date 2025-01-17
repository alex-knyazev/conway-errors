# conway-errors

The library allows you to create an error hierarchy with minimal API usage without explicit class inheritance.

[Go to russian documentation](README_RU.md)

## Usage

### Simple Example

```ts
import { createError } from "conway-errors"; 

// (1) Create the root context, where the base error types are defined
const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" },
] as const);

// (2) Create any number of contexts, for example, divided by team or context
const errorAuthTeamContext = createErrorContext("AuthTeamContext");
const errorPaymentTeamContext = createErrorContext("PaymentTeamContext");

// (3) Define specific implementations based on features
const oauthError = errorAuthTeamContext.feature("OauthError");
const paymentError = errorPaymentTeamContext.feature("PaymentError");

// (4) Example of throwing errors
oauthError.throw("FrontendLogickError", "User not found");
paymentError.throw("BackendLogickError", "Payment already processed");
```

### Nested Contexts

```ts
import { createError } from "conway-errors"; 

// (1) Create the root context, where the base error types are defined
const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" },
] as const);

// (2) Create any number of contexts, for example, divided by team or context
const authTeamErrorContext = createErrorContext("AuthTeamContext");

// (3) Create any number of nested contexts
const socialAuthErrorContext = createErrorContext.subcontext("SocialAuth");
const phoneAuthErrorContext = createErrorContext.subcontext("PhoneAuth");

// (3) Define specific implementations based on features
const facebookError = socialAuthErrorContext.feature("FacebookAuth");
const smsSendError = phoneAuthErrorContext.feature("SmsSender");

// (4) Example of throwing errors
facebookError.throw("FrontendLogickError", "Account inactive");
smsSendError.throw("BackendLogickError", "Limit exceed");
```

### Overriding the Error Throwing Function

Example for integration with Sentry (<https://sentry.io/>)

```ts
import { createError } from "conway-errors"; 
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" }
] as const, {
  // переопределяем поведение выброса ошибки
  throwFn: (err) => {
    Sentry.captureException(err);
  },
});
```

This code will not throw an error globally.

### Extending Base Error Messages

```ts
import { createError } from "conway-errors"; 

const createErrorContext = createError([
  { errorType: "FrontendLogickError", createMessagePostfix: (originalError) => " >>> " + originalError?.message },
  { errorType: "BackendLogickError" },
] as const);

const context = createErrorContext("Context");
const feature = subcontext.feature("Feature");

try {
  uploadAvatar();
} catch (err) {
  feature.throw("FrontendLogickError", "Failed upload avatar", err);
  // The following error will be thrown:
  // FrontendLogickError("Context/Feature: Failed upload avatar >>> Server upload avatar failed")
}
```

### Passing Extended Parameters to Contexts and Errors

```ts
import { createError } from "conway-errors"; 
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(["FrontendLogickError", "BackendLogickError"], {
  extendedParams: {
    isSSR: typeof window === "undefined",
    projectName: "My cool frontend"
  },
  throwFn: (err, extendedParams) => {
    const { isSSR, projectName, logLevel = "error", location, subdomain } = extendedParams;

    Sentry.withScope(scope => {
      scope.setTags({
        isSSR,
        projectName,
        subdomain,
        location,
      });
      

      scope.setLevel(logLevel);
      Sentry.captureException(err);
    });
  },
});


const paymentErrorContext = createErrorContext("Payment", {
  subdomain: "Payment",
});

const cardPaymentError = subcontext.feature("Cardpayment", {
  location: "USA",
});

cardPaymentError.throw("BackendLogickError", "Payment failed", { extendedParams: { logLevel: "fatal" } });
```

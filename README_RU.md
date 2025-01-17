# conway-errors

Библиотека позволяет с помощью минимального API создать иерархию ошибок без использования явного наследования классов.

[Go to english documentation](README.md)

## Использование

### Простой пример

```ts
import { createError } from "conway-errors"; 

// (1) создаем корневой контекст, где определяются базовые типы ошибок
const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" },
] as const);

// (2) создаем любое количество контекстов, например разделяем по команде или контексту
const errorAuthTeamContext = createErrorContext("AuthTeamContext");
const errorPaymentTeamContext = createErrorContext("PaymentTeamContext");

// (3) определяем конкретные реализации на базе функционала (features)
const oauthError = errorAuthTeamContext.feature("OauthError");
const paymentError = errorPaymentTeamContext.feature("PaymentError");

// (4) пример выброса ошибок
oauthError.throw("FrontendLogickError", "User not found");
paymentError.throw("BackendLogickError", "Payment already processed");
```

### Вложенные контексты

```ts
import { createError } from "conway-errors"; 

// (1) создаем корневой контекст, где определяются базовые типы ошибок
const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" },
] as const);

// (2) создаем любое количество контекстов, например разделяем по команде или контексту
const authTeamErrorContext = createErrorContext("AuthTeamContext");

// (3) создаем любое количество вложенных контекстов
const socialAuthErrorContext = createErrorContext.subcontext("SocialAuth");
const phoneAuthErrorContext = createErrorContext.subcontext("PhoneAuth");

// (3) определяем конкретные реализации на базе функционала (features)
const facebookError = socialAuthErrorContext.feature("FacebookAuth");
const smsSendError = phoneAuthErrorContext.feature("SmsSender");

// (4) пример выброса ошибок
facebookError.throw("FrontendLogickError", "Account inactive");
smsSendError.throw("BackendLogickError", "Limit exceed");
```

### Переопределение функции выброса ошибки

Пример для интеграции с Sentry (<https://sentry.io/>)

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

данны код не выбросит ошибку глобально

### Дополнение сообщения базовых ошибок

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
  // будет выброшена ошибка:
  // FrontendLogickError("Context/Feature: Failed upload avatar >>> Server upload avatar failed")
}
```

### Передача расширяемых параметров в контексты и ошибки

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

/**
 * Root interface for any specific error type.
 */
export interface IConwayError extends Error {
  rootContext: string;
  contextsChunk: string;
  originalError?: OriginalError;
}

class ConwayError extends Error implements IConwayError {
  readonly rootContext: string;
  readonly contextsChunk: string;
  readonly originalError?: OriginalError;

  constructor(
    name: string,
    rootContext: string,
    contextsChunk: string,
    message: string,
    originalError?: OriginalError,
  ) {
    super(message);
    this.name = name;
    this.rootContext = rootContext;
    this.contextsChunk = contextsChunk;
    this.originalError = originalError;
  }
}
/**
 * Type guard which helps to understand if error is Conway error.
 * @param error
 * @return {boolean}
 */
export function isConwayError(error: unknown): error is IConwayError {
  return typeof error === "object" && error instanceof ConwayError;
}

function createErrorClass(name: string, rootContext: string) {
  return class extends ConwayError {
    constructor(contextsChunk: string, message: string, originalError?: OriginalError) {
      super(name, rootContext, contextsChunk, message, originalError);
    }
  };
}

function createContextedMessage(contextPath: string, featureName: string, message: string) {
  return `${contextPath}/${featureName}: ${message}`;
}

function defaultEmitFn(err: IConwayError) {
  console.error(err);
}

type ExtendedParams = Record<string, unknown>;

type OriginalError = Error | Record<string, unknown>;

interface CreateErrorOptions {
  emitFn?: (err: IConwayError, extendedParams?: ExtendedParams) => void;
  extendedParams?: ExtendedParams;
}

const defaultErrorOptions: CreateErrorOptions = {
  emitFn: defaultEmitFn,
  extendedParams: {},
};

type ErrorTypeConfig = ReadonlyArray<{
  errorType: string;
  createMessagePostfix?: (originalError?: OriginalError) => string;
}>;

type ErrorMap = Record<
  string,
  {
    errorClass: ReturnType<typeof createErrorClass>;
    createMessagePostfix?: (originalError?: OriginalError) => string;
  }
>;

type FeatureFn<ErrorType extends string> = (
  featureName: string,
  featureContextExtendedParams?: ExtendedParams,
) => FeatureFnResult<ErrorType>;

type FeatureFnResult<ErrorType extends string> = CreateErrorFn<ErrorType> & ObjectWithEmit<ErrorType>;

type CreateErrorFn<ErrorType extends string> = (
  errorType: ErrorType,
  message: string,
  originalError?: OriginalError,
) => IConwayError;

type ObjectWithEmit<ErrorType> = {
  /**
   * Creates and emits error of specified type.
   *
   * @param {ErrorTypes[number]["errorType"]} errorType - The type of the error to throw.
   * @param {string} message - The message for the error.
   * @param {Object} [options={}] - Optional parameters for the error.
   * @param {Error} [options.originalError] - The original error that caused this error.
   * @param {ExtendedParams} [options.extendedParams] - Additional extended parameters for the error.
   * @return {void} This function does not return anything.
   */
  emit: (
    errorType: ErrorType,
    message: string,
    options?: { originalError?: OriginalError; extendedParams?: ExtendedParams },
  ) => void;
  /**
   * Emits previously created error.
   *
   * @param {ErrorTypes[number]["errorType"]} error - already thrown previously error.
   * @param {ExtendedParams} extendedParams - Additional extended parameters for the error.
   * @return {void} This function does not return anything.
   */
  emitCreated: (error: IConwayError, extendedParams?: ExtendedParams) => void;
};

type ErrorSubcontext<ErrorType extends string> = {
  /**
   * Create a child context within the current context.
   *
   * @param {string} childContextName - The name of the child context.
   * @param {ExtendedParams} extendedParams - Additional extended parameters for the child context.
   * @return {Function} Function to create an error context with the specified child context name and extended params.
   */
  subcontext: (subcontextName: string, extendedParams?: ExtendedParams) => ErrorSubcontext<ErrorType>;
  /**
   * Creates a child feature within the current context.
   *
   * @param {string} childFeatureName - The name of the child feature.
   * @param {ExtendedParams} [extendedParams={}] - Additional extended parameters for the child feature.
   * @return {Function} The created error feature.
   */
  feature: FeatureFn<ErrorType>;
};

/**
 * Function to create an error context with specified error types and options.
 *
 * @param {ErrorTypeConfig} errorTypes - Array of error types and optional message postfix creation functions.
 * @param {CreateErrorOptions} options - Options for error creation, including custom throw function and extended params.
 * @return {Function} Function to create an error context with specific context name and extended params.
 */
export function createError<ErrorTypes extends ErrorTypeConfig>(errorTypes?: ErrorTypes, options?: CreateErrorOptions) {
  const _options = { ...defaultErrorOptions, ...options };
  const initialExtendedParams = options?.extendedParams ?? {};

  return (contextName: string, extendedParams: ExtendedParams = {}) => {
    const outerExtendedParams = { ...initialExtendedParams, ...extendedParams };

    const errorsMap: ErrorMap = Array.isArray(errorTypes)
      ? errorTypes.reduce<ErrorMap>((acc, { errorType, createMessagePostfix }) => {
          acc[errorType] = {
            errorClass: createErrorClass(errorType, contextName),
            createMessagePostfix,
          };
          return acc;
        }, {})
      : {};

    const UnknownError = createErrorClass("UnknownError", contextName);

    const _createSubcontext =
      (contextName: string, subContextExtendedParams: ExtendedParams) =>
      (childContextName: string, extendedParams: ExtendedParams = {}) => {
        const subErrorContext = { ...subContextExtendedParams, ...extendedParams };
        return _createErrorContext(`${contextName}/${childContextName}`, subErrorContext);
      };

    function _createErrorContext(
      _contextName: string,
      contextExtendedParams: ExtendedParams = outerExtendedParams,
    ): ErrorSubcontext<ErrorTypes[number]["errorType"]> {
      return {
        subcontext: _createSubcontext(_contextName, contextExtendedParams),
        feature: (childFeatureName: string, extendedParams: ExtendedParams = {}) => {
          const featureErrorContext = { ...contextExtendedParams, ...extendedParams };
          return _createErrorFeature(childFeatureName, _contextName, featureErrorContext);
        },
      };
    }

    function _createErrorFeature(
      featureName: string,
      contextName: string,
      featureContextExtendedParams: ExtendedParams = {},
    ) {
      const createNewErrorObject: CreateErrorFn<ErrorTypes[number]["errorType"]> = (
        errorType,
        message: string,
        originalError?: OriginalError,
      ) => {
        const errorMapItem = errorsMap[errorType];
        const messagePostfix =
          originalError && errorMapItem?.createMessagePostfix ? errorMapItem.createMessagePostfix(originalError) : "";

        const error = new (errorMapItem?.errorClass ?? UnknownError)(
          contextName,
          createContextedMessage(contextName, featureName, message + messagePostfix),
          originalError,
        );

        return error;
      };

      const objectWithEmit: ObjectWithEmit<ErrorTypes[number]["errorType"]> = {
        emit: (errorType, message, options = {}) => {
          const errorObject = createNewErrorObject(errorType, message, options.originalError);
          const _extendedParams = { ...featureContextExtendedParams, ...(options.extendedParams || {}) };
          _options.emitFn?.(errorObject, _extendedParams);
        },
        emitCreated: (error, extendedParams = {}) => {
          const _extendedParams = { ...featureContextExtendedParams, ...extendedParams };
          _options.emitFn?.(error, _extendedParams);
        },
      };

      return Object.assign(createNewErrorObject, objectWithEmit);
    }

    return _createErrorContext(contextName);
  };
}

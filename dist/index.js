var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index2 = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index2) {
        throw new Error("next() called multiple times");
      }
      index2 = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
}, "bufferToFormData");

// node_modules/hono/dist/utils/body.js
var MAX_NESTING_DEPTH = 32;
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form2 = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form2[key] = value;
    } else {
      handleParsingAllValues(form2, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form2).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form2, key, value, nestingState);
        delete form2[key];
      }
    });
  }
  return form2;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form2, key, value) => {
  if (form2[key] !== void 0) {
    if (Array.isArray(form2[key])) {
      ;
      form2[key].push(value);
    } else {
      form2[key] = [form2[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form2[key] = value;
    } else {
      form2[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form2, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form2;
  const keys = key.split(".", MAX_NESTING_DEPTH + 2);
  if (keys.length > MAX_NESTING_DEPTH + 1) {
    throwNestingLimitExceeded();
  }
  keys.forEach((key2, index2) => {
    if (index2 === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) {
          throwNestingLimitExceeded();
        }
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");
var throwNestingLimitExceeded = /* @__PURE__ */ __name(() => {
  throw new Error("Nesting limit exceeded");
}, "throwNestingLimitExceeded");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index2) => {
    const mark = `@${index2}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) {
    url = url.slice(0, hashIndex);
  }
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        const contentType = anyCachedKey === "formData" ? void 0 : raw2.headers.get("content-type");
        return new Response(body, {
          headers: contentType ? { "Content-Type": contentType } : void 0
        })[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie2 of cookies) {
            _res.headers.append("set-cookie", cookie2);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibytes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(methodName, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers13) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers13) {
            this.#addRoute(methodName, this.#path, handler);
          }
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers13) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers13.unshift(arg1);
      }
      handlers13.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/utils.js
var createNullObject = /* @__PURE__ */ __name(() => /* @__PURE__ */ Object.create(null), "createNullObject");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index2 = match3.indexOf("", 1);
    return [matcher[1][index2], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index2, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index2;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = createNullObject();
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    `^${path.replace(
      /\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g,
      (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ONLY_WILDCARD_REG_EXP_STR : `/:${LABEL_REG_EXP_STR}`
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function findMiddleware(middleware, path) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: createNullObject() };
    this.#routes = { [METHOD_NAME_ALL]: createNullObject() };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap[METHOD_NAME_ALL]) {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path === "/*") {
      path = "*";
    }
    const methods = method === METHOD_NAME_ALL ? Object.keys(middleware) : [method];
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      for (const m of methods) {
        if (!middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      }
      for (const handlerMap of [middleware, routes]) {
        for (const m of methods) {
          for (const p in handlerMap[m]) {
            re.test(p) && handlerMap[m][p].push([handler, path]);
          }
        }
      }
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) {
      for (const m of methods) {
        if (!routes[m][path2]) {
          this.#insertPath(m, path2);
          routes[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || [];
        }
        routes[m][path2].push([handler, path2]);
      }
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) {
      matchers[method] = this.#buildMatcher(method);
    }
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) {
      for (const path in r) {
        const handlers13 = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers13.map(([h]) => [h, createNullObject()]), emptyParam];
          continue;
        }
        handlerData[pathData[0]] = handlers13.map(([h, handlerPath]) => [
          h,
          trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
            map[key] = paramReplacementMap[pathData[1][i][1]];
            return map;
          }, createNullObject())
        ]);
      }
    }
    return [regexp, indexReplacementMap.map((i) => handlerData[i]), staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node = new Node2();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/handlers/errors.ts
var CapError = class extends Error {
  static {
    __name(this, "CapError");
  }
  code;
  hint;
  docs;
  constructor(code, message, hint, docs2) {
    super(message);
    this.name = "CapError";
    this.code = code;
    this.hint = hint;
    this.docs = docs2;
  }
};
function notVisible(what = "resource") {
  return new CapError("NOT_FOUND_OR_NOT_VISIBLE", `${what} not found or not visible`);
}
__name(notVisible, "notVisible");

// src/handlers/types.ts
var id = /* @__PURE__ */ __name((p) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, "id");
async function sha2562(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(sha2562, "sha256");

// src/auth.ts
function cookie(req, name) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1];
}
__name(cookie, "cookie");
async function resolvePrincipal(req, env) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || cookie(req, "session");
  if (!token) return { kind: "anonymous", id: "anon" };
  const h = await sha2562(token);
  const row = await env.DB.prepare(
    "SELECT s.principal_id, s.kind, s.delegated_by, s.expires_at, s.participant_survey_id, s.respondent_id, p.email_hash, p.provisioned, p.support FROM session s LEFT JOIN principal p ON p.id = s.principal_id WHERE s.token_hash = ?"
  ).bind(h).first();
  if (row && (!row.expires_at || row.expires_at >= Date.now())) {
    if (row.kind === "participant") return { kind: "participant", id: row.principal_id, participantSurveyId: row.participant_survey_id, respondentId: row.respondent_id };
    if (row.kind === "support" || row.support) return { kind: "support", id: row.principal_id, supportActor: row.delegated_by ?? void 0, provisioned: true };
    return { kind: "user", id: row.principal_id, provisioned: !!row.provisioned, delegatedBy: bearer ? row.delegated_by ?? void 0 : void 0 };
  }
  if (bearer) {
    const participant = await env.DB.prepare(
      "SELECT respondent_id, assessment_survey_id, expires_at, revoked_at FROM participant_session WHERE token_hash = ?"
    ).bind(h).first();
    if (participant && !participant.revoked_at && participant.expires_at > (/* @__PURE__ */ new Date()).toISOString())
      return { kind: "participant", id: participant.respondent_id, participantSurveyId: participant.assessment_survey_id, respondentId: participant.respondent_id };
  }
  return { kind: "anonymous", id: "anon" };
}
__name(resolvePrincipal, "resolvePrincipal");
async function mintSession(env, principalId, kind, extra = {}, ttlMs = 12 * 36e5) {
  const token = `${kind === "participant" ? "pt" : "st"}_${crypto.randomUUID().replace(/-/g, "")}`;
  await env.DB.prepare(
    "INSERT INTO session (token_hash, principal_id, kind, delegated_by, participant_survey_id, respondent_id, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(await sha2562(token), principalId, kind, extra.delegated_by ?? null, extra.participant_survey_id ?? null, extra.respondent_id ?? null, Date.now() + ttlMs, Date.now()).run();
  return token;
}
__name(mintSession, "mintSession");
async function revokeSession(env, token) {
  await env.DB.prepare("DELETE FROM session WHERE token_hash = ?").bind(await sha2562(token)).run();
}
__name(revokeSession, "revokeSession");

// src/envelope.ts
var ok = /* @__PURE__ */ __name((capability, result, trace_id, receipt2) => ({ ok: true, capability, result, trace_id, ...receipt2 ? { receipt: receipt2 } : {} }), "ok");
var fail = /* @__PURE__ */ __name((code, message, hint, docs2, trace_id) => ({ ok: false, error: { code, message, ...hint ? { hint } : {}, ...docs2 ? { docs: docs2 } : {} }, ...trace_id ? { trace_id } : {} }), "fail");
var statusFor = /* @__PURE__ */ __name((code) => ({
  NOT_AUTHENTICATED: 401,
  NOT_AUTHORIZED_AT_SCOPE: 403,
  WRONG_TOOL_FOR_CLASS: 400,
  CONFIRM_REQUIRED: 409,
  CONFIRM_EXPIRED: 409,
  INVALID_PARAMS: 400,
  NOT_FOUND_OR_NOT_VISIBLE: 404,
  STAGE_CONFLICT: 409,
  RESERVED_NOT_BUILT: 501,
  NO_INVERSE: 409
})[code] ?? 400, "statusFor");

// contract/capabilities.json
var capabilities_default = {
  contract: "contract-v0.1",
  status: "DRAFT \u2014 projected by Fable from cookbook 04 @ 59be64c; Lane A (Astra/Otto) accepts, amends or replaces",
  generated_at: "2026-09-16T20:04:22Z",
  source: {
    repo: "klappy/3d-review-cookbook",
    path: "planning/2026-09-16-parity-build/04-CAPABILITY-MATRIX.md",
    sha: "59be64c"
  },
  counts: {
    total: 79,
    read: 28,
    "write.effect": 6,
    "write.reversible": 38,
    "write.dangerous": 7,
    "v2.0-bcs": 71,
    "v2.1-oct": 8,
    paths_inferred: 37,
    inverse_unassessed: 0
  },
  tools: [
    "docs",
    "read",
    "write",
    "danger"
  ],
  errors: [
    "NOT_AUTHENTICATED",
    "NOT_AUTHORIZED_AT_SCOPE",
    "WRONG_TOOL_FOR_CLASS",
    "CONFIRM_REQUIRED",
    "CONFIRM_EXPIRED",
    "INVALID_PARAMS",
    "NOT_FOUND_OR_NOT_VISIBLE",
    "STAGE_CONFLICT",
    "RESERVED_NOT_BUILT",
    "NO_INVERSE"
  ],
  suppressed_is_success: true,
  capabilities: [
    {
      id: "cap.entry.intents",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/entry",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: "public entry (what / how / example / take survey / manage / view results)",
      notes: "bee:10379165",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    },
    {
      id: "cap.entry.example",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/example",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: "sample assessment browsable without login",
      notes: "REQ (09-08); read-only fixture",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    },
    {
      id: "cap.auth.request_link",
      class: "write.effect",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/auth/link",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: '"sign in"',
      notes: "**email-code via Cloudflare** (OF-7 ruled) \u2014 code **mail sent** \u2192 effect; compensate=expire link (not undo); the sign-in submit is the intent-bound confirm",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "expire link "
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "external"
      },
      public: false
    },
    {
      id: "cap.auth.consume_link",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/auth/session",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: "\u2014",
      notes: "issues session",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "cap.auth.logout (compensating)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.auth.logout",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/auth/session",
        path_inferred: false
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: "header",
      notes: "",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "sign in again"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.auth.me",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/me",
        path_inferred: false
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: "header/scope badge",
      notes: "grants + roles per scope",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.participant.redeem_code",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/participate/code",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: '"Take a survey / find my invitation"',
      notes: "short access code \u2192 participant token (bee:10424888)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "token expiry (compensating)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.participant.open_link",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/participate/link",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "A. Entry, identity, session",
      ui_surface: "invitation URL",
      notes: "link token \u2192 participant token",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "token expiry (compensating)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.workspace.create",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/workspaces",
        path_inferred: false
      },
      roles: "provisioned creator (D1)",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: '"Organize projects in a workspace"',
      notes: "request route for others: cap.request.create",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.workspace.archive",
        provenance: "proposed (D5: create reverses to archive, never delete)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.workspace.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/workspaces",
        path_inferred: false
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "context panel",
      notes: "",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.workspace.get",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/workspaces/{id}",
        path_inferred: false
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "workspace page",
      notes: "listing of grouped projects only",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.workspace.update",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "PATCH",
        path: "/v2/workspaces/{id}",
        path_inferred: false
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "settings",
      notes: "rename",
      status: "target",
      inverse: {
        kind: "true",
        via: "self:restore-prior",
        provenance: "proposed (receipt carries prior values)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.workspace.archive",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/workspaces/{id}/archive",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "menu",
      notes: "undo=cap.workspace.unarchive",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.workspace.unarchive",
        provenance: "04"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.workspace.unarchive",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/workspaces/{id}/unarchive",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "menu",
      notes: "",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.workspace.archive",
        provenance: "04"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.workspace.delete",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "DELETE",
        path: "/v2/workspaces/{id}",
        path_inferred: false
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "menu (danger)",
      notes: "D5",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.workspace.add_project",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/workspaces/{id}/projects/{pid}",
        path_inferred: true
      },
      roles: "O, M with share authority (D2)",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "sharing preview",
      notes: "preview shows affected grants",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.workspace.remove_project",
        provenance: "proposed"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.workspace.remove_project",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/workspaces/{id}/projects/{pid}",
        path_inferred: true
      },
      roles: "O, M with share authority (D2)",
      slice: "v2.0-bcs",
      section: "B. Workspace",
      ui_surface: "sharing preview",
      notes: "preview shows affected grants",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.workspace.add_project",
        provenance: "proposed"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.project.create",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/projects",
        path_inferred: false
      },
      roles: "provisioned creator (D1)",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: '"Create or choose a project"',
      notes: "",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.project.archive",
        provenance: "proposed (D5)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.project.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/projects",
        path_inferred: false
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: "All projects; context panel",
      notes: "direct-assessment grantees do **not** see parent",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.project.get",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/projects/{id}",
        path_inferred: false
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: "All projects; context panel",
      notes: "direct-assessment grantees do **not** see parent",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.project.update",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "PATCH",
        path: "/v2/projects/{id}",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: "settings",
      notes: "metadata incl. org/language (metadata only)",
      status: "target",
      inverse: {
        kind: "true",
        via: "self:restore-prior",
        provenance: "proposed"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.project.archive",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/projects/{id}/archive",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: "menu",
      notes: "undo=cap.project.unarchive",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.project.unarchive",
        provenance: "04"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.project.unarchive",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/projects/{id}/unarchive",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: "menu",
      notes: "",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.project.archive",
        provenance: "04"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.project.delete",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "DELETE",
        path: "/v2/projects/{id}",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "C. Project",
      ui_surface: "danger",
      notes: "D5",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.assessment.create",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/projects/{pid}/assessments",
        path_inferred: false
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: '"Start an assessment"',
      notes: "creates in `prepare`",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.assessment.archive",
        provenance: "proposed (D5)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.assessment.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/projects/{pid}/assessments",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "context panel; header",
      notes: "scope/role badge",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.assessment.get",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/assessments/{id}",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "context panel; header",
      notes: "scope/role badge",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.assessment.update",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "PATCH",
        path: "/v2/assessments/{id}",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "Prepare",
      notes: "name, purpose, period, language, format",
      status: "target",
      inverse: {
        kind: "true",
        via: "self:restore-prior",
        provenance: "proposed"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.assessment.set_stage",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{id}/stage",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "stage bar",
      notes: "prepare\u2194collect\u2194understand\u2194improve; receipt",
      status: "target",
      inverse: {
        kind: "true",
        via: "self:reverse-step",
        provenance: "proposed (04-ACCEPTANCE row 16)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.assessment.archive",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{id}/archive",
        path_inferred: true
      },
      roles: "project O, M",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "menu",
      notes: "03 project add/remove assessments; grant checked at project scope (D2: no inheritance); undo=cap.assessment.unarchive",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.assessment.unarchive",
        provenance: "04"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.assessment.unarchive",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{id}/unarchive",
        path_inferred: true
      },
      roles: "project O, M",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "menu",
      notes: "same project grant as archive",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.assessment.archive",
        provenance: "04"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.assessment.delete",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "DELETE",
        path: "/v2/assessments/{id}",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "danger",
      notes: "D5",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.assessment.notes.update",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "PATCH",
        path: "/v2/assessments/{id}/notes",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "D. Assessment (main page)",
      ui_surface: "Improve (reflection, next steps)",
      notes: "",
      status: "target",
      inverse: {
        kind: "true",
        via: "self:restore-prior",
        provenance: "proposed"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.template.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/templates",
        path_inferred: false
      },
      roles: "any signed-in",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: 'Collect: "add a survey"',
      notes: "platform-managed; nine source variants and instrument/scoring/source pins per 14",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.template.get",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/templates/{id}@{ver}",
        path_inferred: false
      },
      roles: "any signed-in",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: 'Collect: "add a survey"',
      notes: "platform-managed (bee:10381612)",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.template.render",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/templates/{id}@{ver}/render",
        path_inferred: true
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: "preview / participant form",
      notes: "render-ready pinned items+options; TR/ML-Q10 multi-select; stable IDs and null/zero semantics (14)",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    },
    {
      id: "cap.template.publish_version",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/templates/{id}/versions",
        path_inferred: false
      },
      roles: "S",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: "admin",
      notes: "platform only",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.survey.select",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/surveys",
        path_inferred: false
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: "Collect",
      notes: "template@version into assessment (D4 wording)",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.survey.deselect",
        provenance: "proposed (only while no responses)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.survey.deselect",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/assessments/{aid}/surveys/{sid}",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: "Collect",
      notes: "after responses exist: archive + preserve, never silent loss",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.survey.select",
        provenance: "proposed (only while no responses; else archive-preserve, inverse none)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.survey.get_status",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/assessments/{aid}/surveys/{sid}",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: "Collect card",
      notes: "counts by perspective",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.survey.print",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/assessments/{aid}/surveys/{sid}/print",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "E. Surveys (templates + assessment surveys)",
      ui_surface: '"Print survey"',
      notes: "**blank form** (no credentials, no responses) \u2014 HTML print stylesheet + PDF via browser (bee:10424888); served by the API so agents get the same artifact (not browser-only)",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.survey.issue_link",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/surveys/{sid}/links",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: 'Collect: "Prepare links"',
      notes: "**prepare/create only** (D1 `invitation` row, unsent); undo=cap.survey.revoke_link (true inverse while unsent)",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.survey.revoke_link",
        provenance: "04 (true inverse while unsent)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.survey.send_links",
      class: "write.effect",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/surveys/{sid}/deliveries",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: 'Collect: "Send links" (impact preview \u2192 confirm)',
      notes: "**split from issue_link** (#13 gap 2; PR #18 example 1): external mail + link disclosure; compensate=cap.survey.revoke_link (access control, not undo); intent bound to recipients/content/expiry/revision; idempotency key; accepted \u2260 delivered; delivery/job receipt; no addresses in telemetry",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "cap.survey.revoke_link"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "external"
      },
      public: false
    },
    {
      id: "cap.survey.issue_codes",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/surveys/{sid}/codes",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: 'Collect: "Access codes"',
      notes: "batch short codes; D1 `access_code` (durable for field collect, not KV); undo=cap.survey.revoke_code while unredeemed. POST result is count/ids/receipt only \u2014 **omits code values**. **Printing/exporting the codes is credential-bearing output** \u2192 `cap.survey.export_codes` (E) below, distinct from a blank-form print",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.survey.revoke_code",
        provenance: "04 (while unredeemed)"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.survey.export_codes",
      class: "write.effect",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/surveys/{sid}/codes/export",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: '"Print access codes" (impact preview \u2192 confirm)',
      notes: "credential-bearing disclosure (release); compensate=revoke codes; audit row; no codes in telemetry; danger body: `mode` + `confirm_token` (+ `lang`); **never GET** (not cacheable/prefetchable; confirm token is not a query string)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "revoke codes"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "external"
      },
      public: false
    },
    {
      id: "cap.survey.revoke_link",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/assessments/{aid}/surveys/{sid}/links/{id}",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "",
      notes: "compensating control for send_links; undo=null once sent (re-issue instead)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "re-issue (04: undo=null once sent)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.survey.revoke_code",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/assessments/{aid}/surveys/{sid}/codes/{id}",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "",
      notes: "",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "re-issue"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.grant.invite",
      class: "write.effect",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/{scope}/{id}/invitations",
        path_inferred: false
      },
      roles: "O, M(\u2264M)",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: '"Invite collaborator" + impact preview \u2192 confirm',
      notes: "invitation **mail sent** \u2192 effect; viewers cannot invite; D3 (proposed); compensate=cap.grant.revoke_invitation",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "cap.grant.revoke_invitation"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "external"
      },
      public: false
    },
    {
      id: "cap.grant.revoke_invitation",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/invitations/{id}",
        path_inferred: false
      },
      roles: "O, M(\u2264M)",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "collaborators panel",
      notes: "compensating control (does not unsend)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "re-invite (04: does not unsend)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.grant.accept",
      class: "write.effect",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/invitations/{token}/accept",
        path_inferred: false
      },
      roles: "invitee",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "",
      notes: "**grant released** \u2192 effect (disclosure of scope contents begins); compensate=cap.grant.revoke",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "cap.grant.revoke"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "external"
      },
      public: false
    },
    {
      id: "cap.grant.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/{scope}/{id}/grants",
        path_inferred: false
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "collaborators panel",
      notes: "",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.grant.update_role",
      class: "write.effect",
      tool: "danger",
      http: {
        method: "PATCH",
        path: "/v2/{scope}/{id}/grants/{gid}",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "impact preview \u2192 confirm",
      notes: "elevation = grant release (effect); demotion is the compensating control; member cannot elevate above self (D3 proposed)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "external"
      },
      public: false
    },
    {
      id: "cap.grant.revoke",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "DELETE",
        path: "/v2/{scope}/{id}/grants/{gid}",
        path_inferred: true
      },
      roles: "O, M(\u2264M)",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "",
      notes: "cannot remove owner; last-owner protected; undo=null (what was seen stays seen) \u2014 re-invite instead",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "re-invite (04: what was seen stays seen)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.grant.transfer_owner",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/{scope}/{id}/transfer",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: "danger",
      notes: "D3",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.request.create",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/requests",
        path_inferred: false
      },
      roles: "any signed-in",
      slice: "v2.0-bcs",
      section: "F. Invitations, codes, collaborators",
      ui_surface: '"Request a project/workspace"',
      notes: "D1 request route",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 withdraw route not in 04"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.response.form",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/participate/form",
        path_inferred: false
      },
      roles: "P",
      slice: "v2.0-bcs",
      section: "G. Participation",
      ui_surface: "survey form",
      notes: "from template.render + language/cycle context; version bound at presentation; participant labels and validation per 14",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.response.submit",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/participate/responses",
        path_inferred: false
      },
      roles: "P",
      slice: "v2.0-bcs",
      section: "G. Participation",
      ui_surface: "review \u2192 submit",
      notes: "append-only; idempotency key; receipt (D6); **undo=null** (append-only is not an inverse \u2014 amendment/retraction policy held under D6); the review screen is the participant's confirm",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "amendment/retraction policy held under D6 (04)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.response.receipt",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/participate/receipt",
        path_inferred: false
      },
      roles: "P",
      slice: "v2.0-bcs",
      section: "G. Participation",
      ui_surface: "receipt screen",
      notes: "reopen link shows retained receipt",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.response.assisted_next",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/participate/next",
        path_inferred: false
      },
      roles: "P (assisted collector)",
      slice: "v2.0-bcs",
      section: "G. Participation",
      ui_surface: '"Next person"',
      notes: "distinct respondent, no duplicate retry (D6)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "none needed \u2014 starts a distinct respondent (D6)"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.response.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/assessments/{aid}/responses",
        path_inferred: false
      },
      roles: "O, M",
      slice: "v2.0-bcs",
      section: "G. Participation",
      ui_surface: "Understand",
      notes: "**always-on small-cell suppression** (July D2 ruling) applied server-side before serialization; threshold/role details held \u2192 affected disclosure blocked until set; viewers see summary only; `SUPPRESSED` is a typed `ok:true` result (never an `ok:false` error)",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.response.purge",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "DELETE",
        path: "/v2/assessments/{aid}/responses",
        path_inferred: true
      },
      roles: "O",
      slice: "v2.0-bcs",
      section: "G. Participation",
      ui_surface: "danger",
      notes: "retention D5",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.results.summary",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/assessments/{aid}/results",
        path_inferred: false
      },
      roles: "Vw+",
      slice: "v2.0-bcs",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "Understand (incl. insufficient-data + suppressed states)",
      notes: "counts, coverage, band-level summary (DEC-0001 bands over scores); **suppression integral from first implementation** (July D2): applied before aggregation disclosure/cache/serialization; UI/MCP cannot request unsuppressed mode; threshold/differencing rules held \u2192 real private results blocked until set, synthetic fixtures may show states; output carries snapshot/algorithm/policy versions (PR #18 example 2)",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.report.build",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/reports",
        path_inferred: false
      },
      roles: "O, M",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "(Oct)",
      notes: "**unimplemented** in v2.0 \u2192 documented 501 + docs pointer; counts \u274C whole-product; suppression + human review of generated interpretation required when built (bee:9416233 per PR #18 BEE-HISTORY)",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "none",
        compensating_control: "v2.1-oct \u2014 UNASSESSED"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.report.get",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/reports/{id}",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "viewer link",
      notes: "unimplemented (501) in v2.0; suppression on disclosure when built",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.report.list",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/assessments/{aid}/reports",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "viewer link",
      notes: "unimplemented (501) in v2.0",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.recommendation.propose",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/assessments/{aid}/recommendations",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "(Oct)",
      notes: "AI-assisted with human review (DEC-0002, POL-0001) \u2014 reserved",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "none",
        compensating_control: "v2.1-oct \u2014 UNASSESSED"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.recommendation.review",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "PATCH",
        path: "/v2/assessments/{aid}/recommendations/{id}",
        path_inferred: true
      },
      roles: "O, M",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "(Oct)",
      notes: "accept/reject with provenance \u2014 reserved",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "none",
        compensating_control: "v2.1-oct \u2014 UNASSESSED"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.rollup.project",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/projects/{id}/rollup",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "(Oct)",
      notes: "unimplemented (501) in v2.0 (D7); suppression on disclosure when built",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.rollup.workspace",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/workspaces/{id}/rollup",
        path_inferred: true
      },
      roles: "Vw+",
      slice: "v2.1-oct",
      section: "H. Results, reports, recommendations (all rows in the whole-product denominator; summary is `v2.0-bcs`, the rest `v2.1-oct`)",
      ui_surface: "(Oct)",
      notes: "unimplemented (501) in v2.0 (D7); suppression on disclosure when built",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.support.acts_as",
      class: "write.dangerous",
      tool: "danger",
      http: {
        method: "POST",
        path: "/v2/support/acts-as",
        path_inferred: false
      },
      roles: "S",
      slice: "v2.0-bcs",
      section: "I. Support & platform",
      ui_surface: "admin",
      notes: "HUMAN-ONLY provisioning; audit row (D8)",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "UNASSESSED \u2014 see 17-IRREVERSIBILITY"
      },
      undo_token: false,
      danger: {
        two_step: true,
        modes: [
          "dry_run",
          "execute"
        ],
        twin_never_get: true,
        effect: "destructive"
      },
      public: false
    },
    {
      id: "cap.support.unlock_participant",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/support/unlock",
        path_inferred: true
      },
      roles: "S",
      slice: "v2.0-bcs",
      section: "I. Support & platform",
      ui_surface: "",
      notes: "reissue code",
      status: "target",
      inverse: {
        kind: "true",
        via: "cap.survey.revoke_code",
        provenance: "proposed"
      },
      undo_token: true,
      public: false
    },
    {
      id: "cap.import.batch",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/imports",
        path_inferred: false
      },
      roles: "S",
      slice: "v2.1-oct",
      section: "I. Support & platform",
      ui_surface: "reserved",
      notes: "July `import_batch`; not this build",
      status: "RESERVED_NOT_BUILT",
      inverse: {
        kind: "none",
        compensating_control: "v2.1-oct \u2014 UNASSESSED"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.ops.trace",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/ops/traces/{trace_id}",
        path_inferred: false
      },
      roles: "actor of that trace, S",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: '"why was this slow?"',
      notes: "**scoped + redacted** projection of the span log (auth, policy, D1 timing, render) \u2014 no answers, addresses or bearer material in spans; a trace id is not authorization: substituted id \u2192 `NOT_FOUND_OR_NOT_VISIBLE`; test it (05 J7)",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: false
    },
    {
      id: "cap.ops.health",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/health",
        path_inferred: false
      },
      roles: "V",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: "",
      notes: "",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    },
    {
      id: "cap.ops.feedback",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/feedback",
        path_inferred: false
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: '"Was this helpful?"',
      notes: "bee:10447875",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "append-only"
      },
      undo_token: false,
      public: true
    },
    {
      id: "cap.ops.undo",
      class: "write.reversible",
      tool: "write",
      http: {
        method: "POST",
        path: "/v2/undo/{token}",
        path_inferred: false
      },
      roles: "actor",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: 'toast "Undo"',
      notes: "reverses **only** rows that declare a true inverse (`undo: cap.x.y`), by invoking that inverse under the same grant; `NO_INVERSE` otherwise; **not a generic 24h undo**; E-class rows never mint undo tokens",
      status: "target",
      inverse: {
        kind: "none",
        compensating_control: "n/a \u2014 this is the undo mechanism"
      },
      undo_token: false,
      public: false
    },
    {
      id: "cap.docs.get",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/docs",
        path_inferred: false
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: "help; MCP `docs`",
      notes: "role-aware capability index; glossary; policies",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    },
    {
      id: "cap.docs.openapi",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/openapi.yaml",
        path_inferred: false
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: "",
      notes: "contract artifacts",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    },
    {
      id: "cap.docs.capabilities",
      class: "read",
      tool: "read",
      http: {
        method: "GET",
        path: "/v2/capabilities.json",
        path_inferred: false
      },
      roles: "any",
      slice: "v2.0-bcs",
      section: "J. Ops, telemetry, xray, docs, feedback",
      ui_surface: "",
      notes: "contract artifacts",
      status: "target",
      inverse: {
        kind: "n/a"
      },
      public: true
    }
  ]
};

// src/registry.ts
var capabilities = capabilities_default.capabilities;
var byId = new Map(capabilities.map((c) => [c.id, c]));
var errorCodes = capabilities_default.errors;
var tools = capabilities_default.tools;
var contractName = capabilities_default.contract;
var sourceSha = capabilities_default.source.sha;
var toolForClass = /* @__PURE__ */ __name((c) => c === "read" ? "read" : c === "write.reversible" ? "write" : "danger", "toolForClass");

// src/handlers/platform.ts
var entryIntents = /* @__PURE__ */ __name(async () => ({ result: { intents: [
  { id: "what", route: "docs" },
  { id: "how", route: "docs {topic:'stages'}" },
  { id: "example", route: "GET /v2/example" },
  { id: "take survey", route: "POST /v2/participate/code" },
  { id: "manage", route: "POST /v2/auth/link" },
  { id: "view results", route: "GET /v2/assessments/{id}/results" }
] } }), "entryIntents");
var entryExample = /* @__PURE__ */ __name(async () => ({ result: { fixture: true, assessment: {
  id: "asm_example",
  name: "Example assessment (fixture)",
  stage: "understand",
  language: "Example language",
  surveys: [{ id: "srv_example", template: "translation-team@1", responses: 12 }],
  summary: { coverage: { translator: 5, community: 4, church: 3 }, bands: { clarity: "mid", naturalness: "high", accuracy: "mid" } }
} } }), "entryExample");
var authRequestLink = /* @__PURE__ */ __name(async (ctx, p, o) => {
  if (!p.email || typeof p.email !== "string") throw new CapError("INVALID_PARAMS", "email required");
  const eh = await sha2562(p.email.toLowerCase());
  if (o?.dryRun) return { result: {}, impact: { affected: [{ email_hash: eh.slice(0, 12) }], irreversible: true, effect: "external", compensating_control: "expire code" } };
  const code = String(Math.floor(1e5 + Math.random() * 9e5));
  await ctx.db.prepare("INSERT INTO login_code (id, email_hash, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)").bind(id("lc"), eh, await sha2562(code), Date.now() + 10 * 6e4, Date.now()).run();
  await ctx.db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id("usr"), eh, 0, 0, (/* @__PURE__ */ new Date()).toISOString()).run();
  ctx.log("auth.code_issued", { email_hash_prefix: eh.slice(0, 8) });
  return { result: { sent: true, expires_in: 600, ...ctx.env.ENVIRONMENT === "dev" ? { dev_only_code: code } : {} }, scope: { type: "platform", id: "auth" } };
}, "authRequestLink");
var authConsumeLink = /* @__PURE__ */ __name(async (ctx, p) => {
  if (!p.email || !p.code) throw new CapError("INVALID_PARAMS", "email and code required");
  const eh = await sha2562(String(p.email).toLowerCase());
  const row = await ctx.db.prepare("SELECT id, expires_at, redeemed_at AS used_at FROM login_code WHERE email_hash = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1").bind(eh, await sha2562(String(p.code))).first();
  if (!row) throw new CapError("INVALID_PARAMS", "code invalid", "request a new code", "cap.auth.request_link");
  if (row.used_at) throw new CapError("INVALID_PARAMS", "code_used", "codes are single-use; request a new one");
  if (row.expires_at < Date.now()) throw new CapError("INVALID_PARAMS", "code_expired", "request a new code");
  await ctx.db.prepare("UPDATE login_code SET redeemed_at = ? WHERE id = ?").bind(Date.now(), row.id).run();
  const pr = await ctx.db.prepare("SELECT id, support FROM principal WHERE email_hash = ?").bind(eh).first();
  const token = await mintSession(ctx.env, pr.id, pr.support ? "support" : "user");
  return { result: { session: token, principal_id: pr.id, note: "phase 0: same token works as cookie `session` and as Bearer (delegated identity contract = 18-D open item D-1)" }, scope: { type: "platform", id: "auth" } };
}, "authConsumeLink");
var authLogout = /* @__PURE__ */ __name(async (ctx, p) => {
  if (p.__token) await revokeSession(ctx.env, p.__token);
  return { result: { signed_out: true }, scope: { type: "platform", id: "auth" } };
}, "authLogout");
var authMe = /* @__PURE__ */ __name(async (ctx) => {
  const pr = ctx.principal;
  if (pr.kind === "anonymous") throw new CapError("NOT_AUTHENTICATED", "no session");
  const grants = pr.kind === "user" || pr.kind === "support" ? (await ctx.db.prepare("SELECT scope_type, scope_id, role FROM grant WHERE principal_id = ?").bind(pr.id).all()).results : [];
  return { result: { principal: { id: pr.id, kind: pr.kind, provisioned: !!pr.provisioned, delegated_by: pr.delegatedBy ?? null, support_actor: pr.supportActor ?? null, participant_survey_id: pr.participantSurveyId ?? null }, grants } };
}, "authMe");
var opsHealth = /* @__PURE__ */ __name(async (ctx) => {
  let d1 = "ok";
  try {
    await ctx.db.prepare("SELECT 1").first();
  } catch (e) {
    d1 = "down";
  }
  return { result: { ok: d1 === "ok", build: "0.0.1-phase0", contract: capabilities_default.contract, source_sha: capabilities_default.source.sha, deps: { d1 }, capabilities: capabilities.length } };
}, "opsHealth");
var opsFeedback = /* @__PURE__ */ __name(async (ctx, p) => {
  const stripped = "answers" in p;
  const { answers: _drop, ...rest } = p;
  await ctx.db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)").bind(id("fb"), ctx.principal.id, String(rest.scope_type ?? "platform"), String(rest.scope_id ?? "-"), JSON.stringify({ context: rest.context ?? null, text: rest.text ?? "", stripped }), (/* @__PURE__ */ new Date()).toISOString()).run();
  return { result: { recorded: true, stripped }, scope: { type: "platform", id: "feedback" } };
}, "opsFeedback");
var opsTrace = /* @__PURE__ */ __name(async (ctx, p) => {
  const row = await ctx.db.prepare("SELECT actor, spans_json, at FROM trace WHERE trace_id = ?").bind(p.trace_id).first();
  if (!row || ctx.principal.kind !== "support" && row.actor !== ctx.principal.id) throw notVisible();
  return { result: { trace_id: p.trace_id, at: row.at, spans: JSON.parse(row.spans_json) } };
}, "opsTrace");
var docsCapabilities = /* @__PURE__ */ __name(async () => ({ result: capabilities_default }), "docsCapabilities");
var docsOpenapi = /* @__PURE__ */ __name(async () => ({ result: { note: "served as YAML at GET /v2/openapi.yaml", capabilities: byId.size } }), "docsOpenapi");

// src/policy.ts
function targetScope(cap, params) {
  const id2 = cap.id;
  if (params.scope && params.id && /^cap\.grant\./.test(id2)) return { type: params.scope, id: params.id };
  if (id2.startsWith("cap.workspace.") && params.id) return { type: "workspace", id: params.id };
  if (id2.startsWith("cap.project.") && params.id) return { type: "project", id: params.id };
  if (id2.startsWith("cap.assessment.") && params.id) return { type: "assessment", id: params.id };
  if (id2 === "cap.assessment.create" || id2 === "cap.assessment.list") return params.pid ? { type: "project", id: params.pid } : null;
  if (id2.startsWith("cap.survey.") || id2.startsWith("cap.response.list") || id2 === "cap.response.purge" || id2 === "cap.results.summary")
    return params.aid ? { type: "assessment", id: params.aid } : null;
  return null;
}
__name(targetScope, "targetScope");
async function roleAt(ctx, scope) {
  const r = await ctx.db.prepare("SELECT role FROM grant WHERE principal_id = ? AND scope_type = ? AND scope_id = ?").bind(ctx.principal.id, scope.type, scope.id).first();
  return r?.role ?? null;
}
__name(roleAt, "roleAt");
var RANK = { viewer: 1, member: 2, owner: 3 };
async function authorize(ctx, cap, params) {
  const p = ctx.principal;
  if (cap.public) return;
  const roles = cap.roles;
  if (roles === "V") return;
  if (p.kind === "anonymous") throw new CapError("NOT_AUTHENTICATED", "sign in first", "POST /v2/auth/link then /v2/auth/session; agents use a delegated bearer", "cap.auth.request_link");
  if (p.kind === "support") return;
  if (roles === "S") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "support only", "ask KCS support", cap.id);
  if (roles === "P" || roles.startsWith("P ")) {
    if (p.kind !== "participant") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "participant token required", "redeem a code or open an invitation link", "cap.participant.redeem_code");
    return;
  }
  if (p.kind === "participant") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "participants cannot call this", void 0, cap.id);
  if (roles.startsWith("provisioned creator")) {
    if (!p.provisioned) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "not provisioned to create", "request one: cap.request.create", "cap.request.create");
    return;
  }
  if (["any", "any signed-in", "actor", "invitee", "actor of that trace, S"].includes(roles)) return;
  const scope = targetScope(cap, params);
  if (!scope) return;
  const role = await roleAt(ctx, scope);
  if (!role) throw notVisible();
  const need = roles.startsWith("O, M") || roles.startsWith("project O, M") ? "member" : roles === "O" ? "owner" : "viewer";
  if (RANK[role] < RANK[need]) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `requires ${need} at ${scope.type}`, need === "owner" ? "ask an owner (D3)" : "ask an owner or member", cap.id);
}
__name(authorize, "authorize");

// src/handlers/docs.ts
var CEILING = "klappy://canon/constraints/mcp-tool-surface-ceiling";
var TOPICS = {
  glossary: "Workspace (optional grouping) \u203A Project \u203A Language \u203A Assessment. An assessment owns the stage Prepare \u2192 Collect \u2192 Understand \u2192 Improve. Survey templates are platform-managed and versioned; an assessment survey is a template@version selected into an assessment. Participants answer by link or short access code and are pseudonymous. Perspective labels follow the instrument: Translator, community, church; four mid-level roles + Other.",
  permissions: "Grants are (principal, scope, role) with role owner/member/viewer at workspace, project or assessment. No inheritance: a workspace grant lists projects, it does not open them. Members invite \u2264 member; owners cannot be removed or demoted; the last owner is protected; transfer is dangerous. Participants are never collaborators. Unauthorized and nonexistent look identical (NOT_FOUND_OR_NOT_VISIBLE).",
  reversibility: "read: no side effect. write.reversible: receipt + undo_token only when a true inverse is declared (archive\u2194unarchive, rename restores prior). write.effect: sends/grants/releases \u2014 dry_run \u2192 confirm_token \u2192 execute; compensating control (revoke) not undo. write.dangerous: destructive \u2014 same two-step; inverse none. Submitting a response is append-only: no undo.",
  telemetry: "Every response carries trace_id. read cap.ops.trace {trace_id} returns your own span log (auth, policy, db timing) scoped and redacted; support sees all. A substituted trace id is NOT_FOUND_OR_NOT_VISIBLE. Telemetry never carries answers, codes or addresses.",
  privacy: "Small-cell suppression is always on for results.summary, response.list and every viewer route. Suppressed is a success: ok:true with suppressed:true \u2014 say 'results are hidden because too few people answered', never a number that reconstructs the cell. Threshold value is held (D7). Codes are never returned by issue_codes; export_codes is a confirmed disclosure.",
  stages: "prepare (set up, pick surveys) \u2192 collect (codes/links live, responses arrive) \u2192 understand (summary, suppression applies) \u2192 improve (notes: reflection, next steps). Moves are one step in either direction via cap.assessment.set_stage; browsing never advances a stage."
};
var INTENTS = ["what", "how", "example", "take survey", "manage", "view results"];
function page(c) {
  return {
    capability: c.id,
    class: c.class,
    tool: c.tool,
    http: `${c.http.method} ${c.http.path}`,
    roles: c.roles,
    slice: c.slice,
    status: c.status,
    section: c.section,
    ui_surface: c.ui_surface,
    rules: c.notes,
    inverse: c.inverse,
    how_an_agent_calls_it: c.tool === "danger" ? "danger {capability, params, mode:'dry_run'} \u2192 impact + confirm_token \u2192 danger {\u2026, mode:'execute', confirm_token}" : `${c.tool} {capability, params}`,
    errors: ["NOT_AUTHENTICATED", "NOT_AUTHORIZED_AT_SCOPE", "WRONG_TOOL_FOR_CLASS", "INVALID_PARAMS", "NOT_FOUND_OR_NOT_VISIBLE", ...c.tool === "danger" ? ["CONFIRM_REQUIRED", "CONFIRM_EXPIRED"] : [], ...c.slice === "v2.1-oct" ? ["RESERVED_NOT_BUILT"] : []],
    examples: { http: `${c.http.method} ${c.http.path}`, mcp: { tool: c.tool, arguments: { capability: c.id, params: {}, ...c.tool === "danger" ? { mode: "dry_run" } : {} } } },
    projected_from: `${contractName} @ cookbook ${sourceSha}`
  };
}
__name(page, "page");
var index = /* @__PURE__ */ __name(() => {
  const g = {};
  for (const c of capabilities) (g[c.section] ??= []).push(c.id + (c.slice === "v2.1-oct" ? " (v2.1-oct, not built)" : ""));
  return g;
}, "index");
var allowedFor = /* @__PURE__ */ __name((role) => capabilities.filter((c) => {
  if (role === "support") return true;
  if (role === "anonymous") return c.public;
  if (role === "participant") return c.roles.startsWith("P") || c.public;
  if (role === "viewer") return c.class === "read" && !/^(O|S|P)/.test(c.roles) || c.public;
  if (role === "member") return !/^(O$|S)/.test(c.roles) && !c.roles.startsWith("P") && c.roles !== "provisioned creator (D1)";
  return !/^S$/.test(c.roles) && !c.roles.startsWith("P");
}).map((c) => c.id), "allowedFor");
var docs = /* @__PURE__ */ __name(async (ctx, a) => {
  if (a.capability) {
    const c = byId.get(a.capability);
    if (!c) return { result: { message: `unknown capability ${a.capability}`, index: index() } };
    const p = page(c);
    if (ctx.principal.kind === "user" && /^(O$|S)/.test(c.roles)) {
      return { result: { ...p, availability: c.roles === "S" ? "not available to collaborators; KCS support only" : "owners only \u2014 ask an owner" } };
    }
    return { result: p };
  }
  if (a.topic) {
    const t = TOPICS[a.topic];
    return { result: t ? { topic: a.topic, text: t } : { message: `unknown topic ${a.topic}`, topics: Object.keys(TOPICS) } };
  }
  if (a.q) {
    const q = String(a.q).toLowerCase();
    return { result: { q, hits: capabilities.filter((c) => (c.id + " " + c.notes + " " + c.ui_surface).toLowerCase().includes(q)).map((c) => ({ id: c.id, class: c.class, section: c.section })) } };
  }
  if (a.role || a.scope) {
    let role = a.role ?? ctx.principal.kind;
    if (a.scope?.type && a.scope?.id && ctx.principal.kind === "user") {
      const r = await roleAt(ctx, a.scope);
      if (!r) throw new CapError("NOT_FOUND_OR_NOT_VISIBLE", "not found or not visible");
      role = r;
    } else if (ctx.principal.kind === "user" && !a.role) role = "member";
    return { result: { role, scope: a.scope ?? null, can: allowedFor(role), next_best: { prepare: "cap.survey.select", collect: "cap.survey.issue_codes", understand: "cap.results.summary", improve: "cap.assessment.notes.update" } } };
  }
  const roles = ctx.principal.kind === "user" ? (await ctx.db.prepare("SELECT scope_type, scope_id, role FROM grant WHERE principal_id = ?").bind(ctx.principal.id).all()).results : [];
  return { result: {
    what: "3D Review helps Bible translation projects assess their own health from three perspectives \u2014 the translation team, the community, and the church \u2014 and turn the findings into next steps. Create or choose a project. Review the survey results. Use the findings to identify improvements. Repeat when it helps your project reflect on progress.",
    tools: { docs: "explain", read: "class=read", write: "class=write.reversible (+ undo)", danger: "write.effect and write.dangerous, two-step" },
    tool_surface: { count: 4, governed_by: CEILING, reason: "read/write/danger split is the host-level permission boundary; telemetry rides read cap.ops.trace and trace_id on every envelope" },
    auth: "Collaborators: email code \u2192 session (cookie for UI, bearer for agents, phase 0 = same token). Participants: access code or invitation link \u2192 participant token bound to one survey. Agents act as a user, never as a role.",
    intents: INTENTS,
    index: index(),
    your_roles: roles,
    contract: `${contractName} @ ${sourceSha}`
  } };
}, "docs");

// src/receipt.ts
var CONFIRM_TTL_SECONDS = 300;
function randomId(prefix, bytes = 12) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return `${prefix}_${b64url(buf)}`;
}
__name(randomId, "randomId");
var newTraceId = /* @__PURE__ */ __name(() => randomId("tr"), "newTraceId");
var newReceiptId = /* @__PURE__ */ __name(() => randomId("rcpt"), "newReceiptId");
var newUndoToken = /* @__PURE__ */ __name(() => randomId("undo", 18), "newUndoToken");
function b64url(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64url, "b64url");
function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - s.length % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
__name(b64urlDecode, "b64urlDecode");
var enc = new TextEncoder();
async function sha256Hex(input) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}
__name(canonical, "canonical");
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
__name(hmacKey, "hmacKey");
async function sign(secret, payload) {
  const key = await hmacKey(secret);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}
__name(sign, "sign");
async function verify(secret, payload, sig) {
  const key = await hmacKey(secret);
  try {
    return await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode(payload));
  } catch {
    return false;
  }
}
__name(verify, "verify");
async function mintConfirmToken(secret, intent, now) {
  const body = { ...intent, exp: Math.floor(now.getTime() / 1e3) + CONFIRM_TTL_SECONDS };
  const payload = b64url(enc.encode(canonical(body)));
  const sig = await sign(secret, payload);
  return { token: `cfm_${payload}.${sig}`, expires_in: CONFIRM_TTL_SECONDS };
}
__name(mintConfirmToken, "mintConfirmToken");
async function checkConfirmToken(secret, token, intent, now) {
  if (typeof token !== "string" || !token.startsWith("cfm_")) return "malformed";
  const [payload, sig] = token.slice(4).split(".");
  if (!payload || !sig) return "malformed";
  if (!await verify(secret, payload, sig)) return "malformed";
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return "malformed";
  }
  if (body.exp < Math.floor(now.getTime() / 1e3)) return "expired";
  for (const k of ["capability", "params_hash", "actor", "scope", "revision"]) if (body[k] !== intent[k]) return "mismatch";
  return "ok";
}
__name(checkConfirmToken, "checkConfirmToken");
async function paramsHash(params) {
  return (await sha256Hex(canonical(params))).slice(0, 32);
}
__name(paramsHash, "paramsHash");
function inverseLabel(cap) {
  return cap.inverse.kind === "true" && cap.inverse.via ? cap.inverse.via : "none";
}
__name(inverseLabel, "inverseLabel");
async function mintReceipt(ctx, input) {
  const { cap } = input;
  const at = ctx.now().toISOString();
  const trueInverse = cap.inverse.kind === "true" && input.mode !== "dry_run";
  const receipt2 = {
    id: newReceiptId(),
    actor: ctx.principal.id,
    scope: input.scope,
    class: cap.class,
    inverse: inverseLabel(cap),
    trace_id: ctx.traceId,
    at
  };
  if (trueInverse) receipt2.undo_token = newUndoToken();
  if (cap.inverse.compensating_control) receipt2.compensating_control = cap.inverse.compensating_control.trim();
  if (input.mode) receipt2.mode = input.mode;
  await persistReceipt(ctx, receipt2, cap.id, input);
  return receipt2;
}
__name(mintReceipt, "mintReceipt");
async function persistReceipt(ctx, r, capabilityId, input) {
  const priorBlob = JSON.stringify({ prior: input.priorState ?? null, params: input.params, result_ids: pickIds(input.result) });
  try {
    await ctx.db.prepare(
      `INSERT INTO receipt (id, actor, capability, scope_type, scope_id, class, inverse, undo_token, confirm_token, trace_id, prior_state_json, at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
    ).bind(r.id, r.actor, capabilityId, r.scope.type, r.scope.id, r.class, r.inverse, r.undo_token ?? null, input.confirmToken ?? null, r.trace_id, priorBlob, r.at).run();
  } catch (e) {
    ctx.log("receipt.persist.failed", { error: String(e) });
    throw e;
  }
}
__name(persistReceipt, "persistReceipt");
function pickIds(o) {
  const out = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    if ((k === "id" || /^[a-z]*id$/.test(k) || k.endsWith("_id")) && (typeof v === "string" || typeof v === "number")) out[k] = v;
  }
  return out;
}
__name(pickIds, "pickIds");
async function findReceiptByUndoToken(ctx, token) {
  const row = await ctx.db.prepare(`SELECT * FROM receipt WHERE undo_token = ?1`).bind(token).first();
  return row ?? null;
}
__name(findReceiptByUndoToken, "findReceiptByUndoToken");
async function consumeUndoToken(ctx, receiptId) {
  await ctx.db.prepare(`UPDATE receipt SET undo_token = NULL WHERE id = ?1`).bind(receiptId).run();
}
__name(consumeUndoToken, "consumeUndoToken");
async function persistTrace(ctx, spans, meta2) {
  const safeSpans = spans.map((s) => ({ span: s.span, t: s.t, ...s.data ? { data: redact(s.data) } : {} }));
  const blob = JSON.stringify({ ...meta2, spans: safeSpans });
  try {
    await ctx.db.prepare(`INSERT INTO trace (trace_id, actor, spans_json, at) VALUES (?1, ?2, ?3, ?4)`).bind(ctx.traceId, ctx.principal.id, blob, ctx.now().toISOString()).run();
  } catch (e) {
    console.warn("trace.persist.failed", ctx.traceId, String(e));
  }
}
__name(persistTrace, "persistTrace");
var REDACT_KEYS = /param|code|email|address|answer|token|secret|password|body|response/i;
function redact(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (REDACT_KEYS.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = typeof v === "object" && v !== null ? "[object]" : v;
  }
  return out;
}
__name(redact, "redact");

// src/handlers/undo.ts
var opsUndo = /* @__PURE__ */ __name(async (ctx, p) => {
  const row = await findReceiptByUndoToken(ctx, String(p.token ?? ""));
  if (!row || row.actor !== ctx.principal.id && ctx.principal.kind !== "support") throw notVisible();
  const cap = byId.get(row.capability);
  if (cap.inverse.kind !== "true") throw new CapError("NO_INVERSE", `${row.capability} has no true inverse`, cap.inverse.compensating_control ?? "see 17-IRREVERSIBILITY", row.capability);
  const blob = row.prior_state_json ? JSON.parse(row.prior_state_json) : {};
  const params = blob.params ?? {};
  const prior = blob.prior ?? {};
  const ids2 = blob.result_ids ?? {};
  const via = cap.inverse.via;
  let r;
  if (via.startsWith("self:")) {
    const h = handlers[row.capability];
    if (!h) throw new CapError("NO_INVERSE", "inverse handler missing");
    const keep = {};
    for (const k of ["id", "pid", "aid", "sid", "scope"]) if (params[k] !== void 0) keep[k] = params[k];
    r = await h(ctx, { ...keep, ...prior });
  } else {
    const h = handlers[via];
    if (!h) throw new CapError("NO_INVERSE", `inverse ${via} not built yet`, "phase 0", via);
    r = await h(ctx, { ...params, ...ids2 });
  }
  await consumeUndoToken(ctx, row.id);
  return { result: { undone: row.capability, via, ...r.result }, scope: { type: row.scope_type, id: row.scope_id } };
}, "opsUndo");

// src/handlers/common.ts
var STAGES = ["prepare", "collect", "understand", "improve"];
var ROLE_RANK = { viewer: 1, member: 2, owner: 3 };
var ROLES = ["owner", "member", "viewer"];
function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
__name(newId, "newId");
function nowIso(ctx) {
  return ctx.now().toISOString();
}
__name(nowIso, "nowIso");
async function sha2563(input) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha2563, "sha256");
function randomToken(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}_${b64}`;
}
__name(randomToken, "randomToken");
function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
__name(randomCode, "randomCode");
function reqStr(p, key) {
  const v = p[key];
  if (typeof v !== "string" || v.length === 0) throw new CapError("INVALID_PARAMS", `${key} is required`, `missing:${key}`);
  return v;
}
__name(reqStr, "reqStr");
function optInt(p, key, def, min = 1, max = 1e3) {
  const v = p[key];
  if (v === void 0 || v === null) return def;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new CapError("INVALID_PARAMS", `${key} must be an integer in [${min},${max}]`, `range:${key}`);
  return n;
}
__name(optInt, "optInt");
function reqRole(p, key = "role") {
  const v = reqStr(p, key);
  if (!ROLES.includes(v)) throw new CapError("INVALID_PARAMS", `${key} must be one of ${ROLES.join("|")}`, `enum:${key}`);
  return v;
}
__name(reqRole, "reqRole");
function reqScope(p) {
  const t = reqStr(p, "scope");
  if (t !== "workspace" && t !== "project" && t !== "assessment") throw new CapError("INVALID_PARAMS", "scope must be workspace|project|assessment", "enum:scope");
  return { type: t, id: reqStr(p, "id") };
}
__name(reqScope, "reqScope");
function patchOf(p, allowed) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "id" || k === "pid" || k === "aid" || k === "sid") continue;
    if (!allowed.includes(k)) throw new CapError("INVALID_PARAMS", `unknown field ${k}`, `allowed:${allowed.join(",")}`);
    if (v !== null && typeof v !== "string") throw new CapError("INVALID_PARAMS", `${k} must be a string or null`, `type:${k}`);
    out[k] = v;
  }
  if (Object.keys(out).length === 0) throw new CapError("INVALID_PARAMS", "no fields to update", `allowed:${allowed.join(",")}`);
  return out;
}
__name(patchOf, "patchOf");
function requireUser(ctx) {
  const p = ctx.principal;
  if (p.kind !== "user" && p.kind !== "support") throw new CapError("NOT_AUTHENTICATED", "sign in required");
  return p.id;
}
__name(requireUser, "requireUser");
function requireSupport(ctx) {
  if (ctx.principal.kind !== "support") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "support capability required", "D8");
  return ctx.principal.id;
}
__name(requireSupport, "requireSupport");
async function roleAt2(ctx, scopeType, scopeId) {
  if (ctx.principal.kind !== "user" && ctx.principal.kind !== "support") return null;
  const row = await ctx.db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind(ctx.principal.id, scopeType, scopeId).first();
  return row?.role ?? null;
}
__name(roleAt2, "roleAt");
function atLeast(role, min) {
  return !!role && ROLE_RANK[role] >= ROLE_RANK[min];
}
__name(atLeast, "atLeast");
function gate(role, min, what, hint) {
  if (!role) throw notVisible(what);
  if (!atLeast(role, min)) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `${min} role required at this ${what}`, hint);
  return role;
}
__name(gate, "gate");
async function loadWorkspace(ctx, id2, min = "viewer") {
  const row = await ctx.db.prepare("SELECT * FROM workspace WHERE id = ?").bind(id2).first();
  const role = row ? await roleAt2(ctx, "workspace", id2) : null;
  if (!row) throw notVisible("workspace");
  return { row, role: gate(role, min, "workspace") };
}
__name(loadWorkspace, "loadWorkspace");
async function loadProject(ctx, id2, min = "viewer") {
  const row = await ctx.db.prepare("SELECT * FROM project WHERE id = ?").bind(id2).first();
  const role = row ? await roleAt2(ctx, "project", id2) : null;
  if (!row) throw notVisible("project");
  return { row, role: gate(role, min, "project") };
}
__name(loadProject, "loadProject");
async function loadTemplate(ctx, id2, version) {
  const row = version === void 0 ? await ctx.db.prepare("SELECT * FROM survey_template WHERE id = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1").bind(id2).first() : await ctx.db.prepare("SELECT * FROM survey_template WHERE id = ? AND version = ?").bind(id2, version).first();
  if (!row) throw notVisible("template");
  return row;
}
__name(loadTemplate, "loadTemplate");
function parseItems(t) {
  try {
    return JSON.parse(t.items_json);
  } catch {
    return [];
  }
}
__name(parseItems, "parseItems");
function renderItems(items, lang) {
  return items.map((it) => ({
    id: it.id,
    group: it.group,
    type: it.type,
    text: it.text,
    lang,
    ...it.scale ? { scale: it.scale } : {},
    ...it.options ? { options: it.options.map((o) => ({ code: o.code, text: o.text })) } : {},
    ...it.max_select ? { max_select: it.max_select } : {},
    ...it.standalone_indicator ? { standalone_indicator: true } : {}
  }));
}
__name(renderItems, "renderItems");
function participantLabels(templateId) {
  if (templateId === "tpl_validation") return ["Translator"];
  if (templateId === "tpl_mid_level") return ["Facilitator", "Team Leader", "Consultant-in-Training", "Translation Advisor", "Other"];
  return [];
}
__name(participantLabels, "participantLabels");
async function countScalar(ctx, sql, ...binds) {
  const row = await ctx.db.prepare(sql).bind(...binds).first();
  return Number(row?.n ?? 0);
}
__name(countScalar, "countScalar");
async function auditRow(ctx, capability, scope, detail) {
  const id2 = newId("audit");
  await ctx.db.prepare("INSERT INTO receipt (id, actor, capability, scope_type, scope_id, class, inverse, trace_id, prior_state_json, at) VALUES (?, ?, ?, ?, ?, 'audit', 'none', ?, ?, ?)").bind(id2, ctx.principal.id, capability, scope.type, scope.id, ctx.traceId, JSON.stringify(detail), nowIso(ctx)).run();
  return id2;
}
__name(auditRow, "auditRow");

// src/handlers/workspace.ts
function view(w, role) {
  return { id: w.id, name: w.name, archived_at: w.archived_at, created_at: w.created_at, role };
}
__name(view, "view");
var create = /* @__PURE__ */ __name(async (ctx, params) => {
  const actor = requireUser(ctx);
  const p = await ctx.db.prepare("SELECT provisioned FROM principal WHERE id = ?").bind(actor).first();
  if (!p || !p.provisioned) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "workspace creation is provisioned", "D1: request one via cap.request.create");
  const id2 = newId("ws");
  const at = nowIso(ctx);
  const name = reqStr(params, "name");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?, ?, ?, ?)").bind(id2, name, at, actor),
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId("grant"), actor, "workspace", id2, "owner", at)
  ]);
  return { result: { workspace: { id: id2, name, archived_at: null, created_at: at, role: "owner" } }, scope: { type: "workspace", id: id2 } };
}, "create");
var list = /* @__PURE__ */ __name(async (ctx) => {
  const actor = requireUser(ctx);
  const { results } = await ctx.db.prepare('SELECT w.*, g.role AS role FROM workspace w JOIN "grant" g ON g.scope_type = ? AND g.scope_id = w.id WHERE g.principal_id = ? ORDER BY w.created_at').bind("workspace", actor).all();
  return { result: { workspaces: results.map((w) => view(w, w.role)) } };
}, "list");
var get = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id");
  const { row, role } = await loadWorkspace(ctx, id2);
  const { results } = await ctx.db.prepare("SELECT id, name, organization, archived_at FROM project WHERE workspace_id = ? ORDER BY created_at").bind(id2).all();
  return { result: { workspace: view(row, role), projects: results }, scope: { type: "workspace", id: id2 } };
}, "get");
var update = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id2, "owner");
  const patch = patchOf(params, ["name"]);
  if (patch.name === null || patch.name === "") throw new CapError("INVALID_PARAMS", "name cannot be empty", "name");
  await ctx.db.prepare("UPDATE workspace SET name = ? WHERE id = ?").bind(patch.name, id2).run();
  return { result: { workspace: { ...view(row, "owner"), name: patch.name } }, scope: { type: "workspace", id: id2 }, priorState: { name: row.name } };
}, "update");
var archive = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id2, "owner");
  const at = nowIso(ctx);
  await ctx.db.prepare("UPDATE workspace SET archived_at = COALESCE(archived_at, ?) WHERE id = ?").bind(at, id2).run();
  return { result: { workspace: { ...view(row, "owner"), archived_at: row.archived_at ?? at } }, scope: { type: "workspace", id: id2 }, priorState: { archived_at: row.archived_at } };
}, "archive");
var unarchive = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id2, "owner");
  await ctx.db.prepare("UPDATE workspace SET archived_at = NULL WHERE id = ?").bind(id2).run();
  return { result: { workspace: { ...view(row, "owner"), archived_at: null } }, scope: { type: "workspace", id: id2 }, priorState: { archived_at: row.archived_at } };
}, "unarchive");
var del = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  const id2 = reqStr(params, "id");
  const { row } = await loadWorkspace(ctx, id2, "owner");
  const projects = await countScalar(ctx, "SELECT COUNT(*) AS n FROM project WHERE workspace_id = ?", id2);
  const assessments = await countScalar(ctx, "SELECT COUNT(*) AS n FROM assessment a JOIN project p ON p.id = a.project_id WHERE p.workspace_id = ?", id2);
  const responses = await countScalar(ctx, "SELECT COUNT(*) AS n FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id JOIN assessment a ON a.id = s.assessment_id JOIN project p ON p.id = a.project_id WHERE p.workspace_id = ?", id2);
  const grants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", id2);
  const impact = {
    affected: [{ workspace: id2, projects, assessments, responses, grants }],
    irreversible: true,
    effect: "destructive",
    retention: "D5 held: phase 0 deletes only an empty workspace; remove projects first (they keep their own grants)"
  };
  if (opts?.dryRun) return { result: { workspace: view(row, "owner") }, scope: { type: "workspace", id: id2 }, impact };
  if (projects > 0) throw new CapError("INVALID_PARAMS", "workspace still groups projects", "has_projects");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("workspace", id2),
    ctx.db.prepare("DELETE FROM invitation WHERE scope_type = ? AND scope_id = ?").bind("workspace", id2),
    ctx.db.prepare("DELETE FROM workspace WHERE id = ?").bind(id2)
  ]);
  return { result: { deleted: true, id: id2 }, scope: { type: "workspace", id: id2 }, impact, priorState: { workspace: row } };
}, "del");
async function shareAuthority(ctx, wid, pid) {
  const { row: w, role: wRole } = await loadWorkspace(ctx, wid, "member");
  const { row: p, role: pRole } = await loadProject(ctx, pid, "viewer");
  const ok2 = wRole === "owner" && atLeast(pRole, "member") || wRole === "member" && pRole === "owner";
  if (!ok2) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "share authority over the project is required", "D2");
  return { w, p };
}
__name(shareAuthority, "shareAuthority");
var add_project = /* @__PURE__ */ __name(async (ctx, params) => {
  const wid = reqStr(params, "id");
  const pid = reqStr(params, "pid");
  const { p } = await shareAuthority(ctx, wid, pid);
  if (p.workspace_id && p.workspace_id !== wid) throw new CapError("INVALID_PARAMS", "project already grouped in another workspace", "remove_project first");
  await ctx.db.prepare("UPDATE project SET workspace_id = ? WHERE id = ?").bind(wid, pid).run();
  const affectedGrants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", wid);
  return { result: { workspace_id: wid, project_id: pid, grouped: true, workspace_grantees_now_listing: affectedGrants }, scope: { type: "workspace", id: wid }, priorState: { workspace_id: p.workspace_id } };
}, "add_project");
var remove_project = /* @__PURE__ */ __name(async (ctx, params) => {
  const wid = reqStr(params, "id");
  const pid = reqStr(params, "pid");
  const { p } = await shareAuthority(ctx, wid, pid);
  if (p.workspace_id !== wid) throw notVisible("project in workspace");
  await ctx.db.prepare("UPDATE project SET workspace_id = NULL WHERE id = ?").bind(pid).run();
  const affectedGrants = await countScalar(ctx, 'SELECT COUNT(*) AS n FROM "grant" WHERE scope_type = ? AND scope_id = ?', "workspace", wid);
  return { result: { workspace_id: wid, project_id: pid, grouped: false, workspace_grantees_no_longer_listing: affectedGrants }, scope: { type: "workspace", id: wid }, priorState: { workspace_id: wid } };
}, "remove_project");
var handlers2 = {
  "cap.workspace.create": create,
  "cap.workspace.list": list,
  "cap.workspace.get": get,
  "cap.workspace.update": update,
  "cap.workspace.archive": archive,
  "cap.workspace.unarchive": unarchive,
  "cap.workspace.delete": del,
  "cap.workspace.add_project": add_project,
  "cap.workspace.remove_project": remove_project
};

// src/handlers/project.ts
var view2 = /* @__PURE__ */ __name((p, role) => ({ id: p.id, workspace_id: p.workspace_id, name: p.name, organization: p.organization, archived_at: p.archived_at, created_at: p.created_at, role }), "view");
var create2 = /* @__PURE__ */ __name(async (ctx, params) => {
  const actor = requireUser(ctx);
  const provisioned = await ctx.db.prepare("SELECT provisioned FROM principal WHERE id = ?").bind(actor).first();
  if (!provisioned?.provisioned) throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "project creation is provisioned", "D1");
  const name = reqStr(params, "name");
  const organization = params.organization === void 0 ? null : reqStr(params, "organization");
  const id2 = newId("proj"), at = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO project (id, name, organization, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(id2, name, organization, at, actor),
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId("grant"), actor, "project", id2, "owner", at)
  ]);
  return { result: { project: { id: id2, workspace_id: null, name, organization, archived_at: null, created_at: at, role: "owner" } }, scope: { type: "project", id: id2 } };
}, "create");
var list2 = /* @__PURE__ */ __name(async (ctx) => {
  const actor = requireUser(ctx);
  const { results } = await ctx.db.prepare('SELECT p.*, g.role FROM project p JOIN "grant" g ON g.scope_type = ? AND g.scope_id = p.id WHERE g.principal_id = ? ORDER BY p.created_at').bind("project", actor).all();
  return { result: { projects: results.map((p) => view2(p, p.role)) } };
}, "list");
var get2 = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row, role } = await loadProject(ctx, id2);
  const { results } = await ctx.db.prepare("SELECT id, code, name FROM language WHERE project_id = ? ORDER BY name").bind(id2).all();
  return { result: { project: view2(row, role), languages: results }, scope: { type: "project", id: id2 } };
}, "get");
var update2 = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row } = await loadProject(ctx, id2, "owner");
  const patch = patchOf(params, ["name", "organization"]);
  const name = patch.name === void 0 ? row.name : patch.name;
  if (!name) throw new CapError("INVALID_PARAMS", "name cannot be empty");
  const organization = patch.organization === void 0 ? row.organization : patch.organization;
  await ctx.db.prepare("UPDATE project SET name = ?, organization = ? WHERE id = ?").bind(name, organization, id2).run();
  return { result: { project: { ...view2(row, "owner"), name, organization } }, scope: { type: "project", id: id2 }, priorState: { name: row.name, organization: row.organization } };
}, "update");
var archive2 = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row } = await loadProject(ctx, id2, "owner");
  const at = row.archived_at ?? nowIso(ctx);
  await ctx.db.prepare("UPDATE project SET archived_at = ? WHERE id = ?").bind(at, id2).run();
  return { result: { project: { ...view2(row, "owner"), archived_at: at } }, scope: { type: "project", id: id2 }, priorState: { archived_at: row.archived_at } };
}, "archive");
var unarchive2 = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row } = await loadProject(ctx, id2, "owner");
  await ctx.db.prepare("UPDATE project SET archived_at = NULL WHERE id = ?").bind(id2).run();
  return { result: { project: { ...view2(row, "owner"), archived_at: null } }, scope: { type: "project", id: id2 }, priorState: { archived_at: row.archived_at } };
}, "unarchive");
var del2 = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  const id2 = reqStr(params, "id"), { row } = await loadProject(ctx, id2, "owner");
  const assessments = await countScalar(ctx, "SELECT COUNT(*) AS n FROM assessment WHERE project_id = ?", id2);
  const languages = await countScalar(ctx, "SELECT COUNT(*) AS n FROM language WHERE project_id = ?", id2);
  const impact = { affected: [{ project: id2, assessments, languages }], irreversible: true, effect: "destructive", retention: "D5 held: only empty projects can be hard-deleted" };
  if (opts?.dryRun) return { result: { project: view2(row, "owner") }, scope: { type: "project", id: id2 }, impact };
  if (assessments || languages) throw new CapError("INVALID_PARAMS", "project is not empty", "remove dependent data first");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("project", id2),
    ctx.db.prepare("DELETE FROM invitation WHERE scope_type = ? AND scope_id = ?").bind("project", id2),
    ctx.db.prepare("DELETE FROM project WHERE id = ?").bind(id2)
  ]);
  return { result: { deleted: true, id: id2 }, scope: { type: "project", id: id2 }, impact, priorState: { project: row } };
}, "del");
var handlers3 = {
  "cap.project.create": create2,
  "cap.project.list": list2,
  "cap.project.get": get2,
  "cap.project.update": update2,
  "cap.project.archive": archive2,
  "cap.project.unarchive": unarchive2,
  "cap.project.delete": del2
};

// src/handlers/assessment.ts
async function exact(ctx, id2, min = "viewer") {
  const row = await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id2).first();
  if (!row) throw notVisible("assessment");
  return { row, role: gate(await roleAt2(ctx, "assessment", id2), min, "assessment") };
}
__name(exact, "exact");
var view3 = /* @__PURE__ */ __name((a, role) => ({ ...a, role }), "view");
async function language(ctx, pid, languageId) {
  const row = await ctx.db.prepare("SELECT id FROM language WHERE id = ? AND project_id = ?").bind(languageId, pid).first();
  if (!row) throw notVisible("language");
}
__name(language, "language");
var create3 = /* @__PURE__ */ __name(async (ctx, params) => {
  const pid = reqStr(params, "pid");
  await loadProject(ctx, pid, "member");
  const name = reqStr(params, "name"), language_id = reqStr(params, "language_id");
  await language(ctx, pid, language_id);
  const id2 = newId("assess"), at = nowIso(ctx);
  const purpose = params.purpose === void 0 ? null : reqStr(params, "purpose");
  const period = params.period === void 0 ? null : reqStr(params, "period");
  const format = params.format === void 0 ? null : reqStr(params, "format");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO assessment (id, project_id, language_id, name, purpose, period, format, stage, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'prepare', ?, ?)").bind(id2, pid, language_id, name, purpose, period, format, at, ctx.principal.id),
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId("grant"), ctx.principal.id, "assessment", id2, "owner", at)
  ]);
  return { result: { assessment: { id: id2, project_id: pid, language_id, name, purpose, period, format, stage: "prepare", archived_at: null, created_at: at, role: "owner" } }, scope: { type: "assessment", id: id2 } };
}, "create");
var list3 = /* @__PURE__ */ __name(async (ctx, params) => {
  const pid = reqStr(params, "pid");
  await loadProject(ctx, pid);
  const { results } = await ctx.db.prepare('SELECT a.*, g.role FROM assessment a JOIN "grant" g ON g.scope_type = ? AND g.scope_id = a.id WHERE a.project_id = ? AND g.principal_id = ? ORDER BY a.created_at').bind("assessment", pid, ctx.principal.id).all();
  return { result: { assessments: results.map((a) => view3(a, a.role)) }, scope: { type: "project", id: pid } };
}, "list");
var get3 = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row, role } = await exact(ctx, id2);
  const { results } = await ctx.db.prepare("SELECT s.id, s.template_id, s.template_version, s.state, s.collection_status, s.archived_at, s.created_at, t.name AS template_name, t.perspective FROM assessment_survey s JOIN survey_template t ON t.id = s.template_id AND t.version = s.template_version WHERE s.assessment_id = ? ORDER BY s.created_at").bind(id2).all();
  return { result: { assessment: view3(row, role), surveys: results }, scope: { type: "assessment", id: id2 } };
}, "get");
var update3 = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row, role } = await exact(ctx, id2, "member");
  const patch = patchOf(params, ["name", "purpose", "period", "language_id", "format"]);
  if (patch.name !== void 0 && !patch.name) throw new CapError("INVALID_PARAMS", "name cannot be empty");
  if (patch.language_id !== void 0) {
    if (!patch.language_id) throw new CapError("INVALID_PARAMS", "language_id cannot be empty");
    await language(ctx, row.project_id, patch.language_id);
  }
  const next = { name: patch.name ?? row.name, purpose: patch.purpose === void 0 ? row.purpose : patch.purpose, period: patch.period === void 0 ? row.period : patch.period, language_id: patch.language_id ?? row.language_id, format: patch.format === void 0 ? row.format : patch.format };
  await ctx.db.prepare("UPDATE assessment SET name = ?, purpose = ?, period = ?, language_id = ?, format = ? WHERE id = ?").bind(next.name, next.purpose, next.period, next.language_id, next.format, id2).run();
  return { result: { assessment: view3({ ...row, ...next }, role) }, scope: { type: "assessment", id: id2 }, priorState: { name: row.name, purpose: row.purpose, period: row.period, language_id: row.language_id, format: row.format } };
}, "update");
var set_stage = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row, role } = await exact(ctx, id2, "member");
  const stage = reqStr(params, "stage");
  const current = STAGES.indexOf(row.stage), next = STAGES.indexOf(stage);
  if (next < 0) throw new CapError("INVALID_PARAMS", "invalid stage");
  if (Math.abs(next - current) !== 1) throw new CapError("STAGE_CONFLICT", "move one stage at a time");
  await ctx.db.prepare("UPDATE assessment SET stage = ? WHERE id = ?").bind(stage, id2).run();
  return { result: { assessment: view3({ ...row, stage }, role) }, scope: { type: "assessment", id: id2 }, priorState: { stage: row.stage } };
}, "set_stage");
async function archiveChange(ctx, params, archived) {
  const id2 = reqStr(params, "id");
  const row = await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id2).first();
  if (!row) throw notVisible("assessment");
  await loadProject(ctx, row.project_id, "member");
  const at = archived ? row.archived_at ?? nowIso(ctx) : null;
  await ctx.db.prepare("UPDATE assessment SET archived_at = ? WHERE id = ?").bind(at, id2).run();
  return { result: { assessment: { ...row, archived_at: at } }, scope: { type: "assessment", id: id2 }, priorState: { archived_at: row.archived_at } };
}
__name(archiveChange, "archiveChange");
var archive3 = /* @__PURE__ */ __name((ctx, params) => archiveChange(ctx, params, true), "archive");
var unarchive3 = /* @__PURE__ */ __name((ctx, params) => archiveChange(ctx, params, false), "unarchive");
var notes_update = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), { row, role } = await exact(ctx, id2, "member");
  const patch = patchOf(params, ["notes_reflection", "notes_next_steps"]);
  const notes_reflection = patch.notes_reflection === void 0 ? row.notes_reflection : patch.notes_reflection;
  const notes_next_steps = patch.notes_next_steps === void 0 ? row.notes_next_steps : patch.notes_next_steps;
  await ctx.db.prepare("UPDATE assessment SET notes_reflection = ?, notes_next_steps = ? WHERE id = ?").bind(notes_reflection, notes_next_steps, id2).run();
  return { result: { assessment: view3({ ...row, notes_reflection, notes_next_steps }, role) }, scope: { type: "assessment", id: id2 }, priorState: { notes_reflection: row.notes_reflection, notes_next_steps: row.notes_next_steps } };
}, "notes_update");
var del3 = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  const id2 = reqStr(params, "id"), { row } = await exact(ctx, id2, "owner");
  const surveys = await countScalar(ctx, "SELECT COUNT(*) AS n FROM assessment_survey WHERE assessment_id = ?", id2);
  const responses = await countScalar(ctx, "SELECT COUNT(*) AS n FROM response r JOIN assessment_survey s ON s.id = r.assessment_survey_id WHERE s.assessment_id = ?", id2);
  const impact = { affected: [{ assessment: id2, surveys, responses }], irreversible: true, effect: "destructive", retention: "D5 held: only empty assessments can be hard-deleted" };
  if (opts?.dryRun) return { result: { assessment: view3(row, "owner") }, scope: { type: "assessment", id: id2 }, impact };
  if (surveys || responses) throw new CapError("INVALID_PARAMS", "assessment is not empty", "deselect surveys first");
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM "grant" WHERE scope_type = ? AND scope_id = ?').bind("assessment", id2),
    ctx.db.prepare("DELETE FROM assessment WHERE id = ?").bind(id2)
  ]);
  return { result: { deleted: true, id: id2 }, scope: { type: "assessment", id: id2 }, impact, priorState: { assessment: row } };
}, "del");
var handlers4 = {
  "cap.assessment.create": create3,
  "cap.assessment.list": list3,
  "cap.assessment.get": get3,
  "cap.assessment.update": update3,
  "cap.assessment.set_stage": set_stage,
  "cap.assessment.archive": archive3,
  "cap.assessment.unarchive": unarchive3,
  "cap.assessment.delete": del3,
  "cap.assessment.notes.update": notes_update
};

// src/handlers/template.ts
function meta(t) {
  return { id: t.id, version: t.version, name: t.name, perspective: t.perspective, source_ref: t.source_ref, published_at: t.published_at };
}
__name(meta, "meta");
var list4 = /* @__PURE__ */ __name(async (ctx) => {
  requireUser(ctx);
  const { results } = await ctx.db.prepare("SELECT id, version, name, perspective, source_ref, published_at FROM survey_template WHERE published_at IS NOT NULL ORDER BY name, version DESC").all();
  return { result: { templates: results.map(meta) } };
}, "list");
var get4 = /* @__PURE__ */ __name(async (ctx, params) => {
  requireUser(ctx);
  const id2 = reqStr(params, "id"), version = optInt(params, "ver", 0, 0);
  const row = await loadTemplate(ctx, id2, version || void 0);
  return { result: { template: { ...meta(row), items: parseItems(row), rubric_ref: row.rubric_ref } } };
}, "get");
var render = /* @__PURE__ */ __name(async (ctx, params) => {
  const id2 = reqStr(params, "id"), version = optInt(params, "ver", 0, 0);
  const row = await loadTemplate(ctx, id2, version || void 0);
  const lang = typeof params.lang === "string" && params.lang ? params.lang : "en";
  return { result: { template: meta(row), lang, items: renderItems(parseItems(row), lang) } };
}, "render");
var publish_version = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  requireSupport(ctx);
  const id2 = reqStr(params, "id"), name = reqStr(params, "name"), perspective = reqStr(params, "perspective");
  const items = params.items, scoring = params.scoring;
  if (!Array.isArray(items) || !scoring || typeof scoring !== "object" || Array.isArray(scoring)) throw new CapError("INVALID_PARAMS", "items array and scoring object required");
  const source_ref = reqStr(params, "source_ref"), rubric_ref = reqStr(params, "rubric_ref");
  const row = await ctx.db.prepare("SELECT MAX(version) AS version FROM survey_template WHERE id = ?").bind(id2).first();
  const version = Number(row?.version ?? 0) + 1;
  const impact = { affected: [{ template: id2, new_version: version }], irreversible: true, effect: "destructive", retention: "Published versions are immutable; a later version supersedes rather than overwrites" };
  if (opts?.dryRun) return { result: { template_id: id2, version }, scope: { type: "platform", id: id2 }, impact };
  const at = nowIso(ctx);
  await ctx.db.prepare("INSERT INTO survey_template (id, version, name, perspective, source_ref, items_json, scoring_json, rubric_ref, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id2, version, name, perspective, source_ref, JSON.stringify(items), JSON.stringify(scoring), rubric_ref, at).run();
  return { result: { template: { id: id2, version, name, perspective, source_ref, rubric_ref, published_at: at } }, scope: { type: "platform", id: id2 }, impact };
}, "publish_version");
var handlers5 = { "cap.template.list": list4, "cap.template.get": get4, "cap.template.render": render, "cap.template.publish_version": publish_version };

// src/handlers/survey.ts
async function assessment(ctx, id2, min = "viewer") {
  const row = await ctx.db.prepare("SELECT * FROM assessment WHERE id = ?").bind(id2).first();
  if (!row) throw notVisible("assessment");
  return { row, role: gate(await roleAt2(ctx, "assessment", id2), min, "assessment") };
}
__name(assessment, "assessment");
async function survey(ctx, aid, sid, min = "viewer") {
  await assessment(ctx, aid, min);
  const row = await ctx.db.prepare("SELECT * FROM assessment_survey WHERE id = ? AND assessment_id = ?").bind(sid, aid).first();
  if (!row) throw notVisible("survey");
  return row;
}
__name(survey, "survey");
function ids(params) {
  return { aid: reqStr(params, "aid"), sid: reqStr(params, "sid") };
}
__name(ids, "ids");
var select = /* @__PURE__ */ __name(async (ctx, params) => {
  const aid = reqStr(params, "aid");
  await assessment(ctx, aid, "member");
  const template_id = reqStr(params, "template_id"), version = optInt(params, "version", 0, 0);
  const t = await loadTemplate(ctx, template_id, version || void 0);
  const existing = await ctx.db.prepare("SELECT * FROM assessment_survey WHERE assessment_id = ? AND template_id = ? AND template_version = ?").bind(aid, t.id, t.version).first();
  if (existing) {
    if (existing.state === "archived") await ctx.db.prepare("UPDATE assessment_survey SET state = 'selected', archived_at = NULL WHERE id = ?").bind(existing.id).run();
    return { result: { survey: { ...existing, state: "selected", archived_at: null }, selected: true }, scope: { type: "assessment", id: aid }, priorState: { state: existing.state, archived_at: existing.archived_at } };
  }
  const id2 = newId("survey"), at = nowIso(ctx);
  await ctx.db.prepare("INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) VALUES (?, ?, ?, ?, 'selected', 'closed', ?)").bind(id2, aid, t.id, t.version, at).run();
  return { result: { survey: { id: id2, assessment_id: aid, template_id: t.id, template_version: t.version, state: "selected", collection_status: "closed", created_at: at }, selected: true }, scope: { type: "assessment", id: aid } };
}, "select");
var deselect = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params), row = await survey(ctx, aid, sid, "member");
  const responses = await countScalar(ctx, "SELECT COUNT(*) AS n FROM response WHERE assessment_survey_id = ?", sid);
  const codes = await countScalar(ctx, "SELECT COUNT(*) AS n FROM access_code WHERE assessment_survey_id = ?", sid);
  const invitations = await countScalar(ctx, "SELECT COUNT(*) AS n FROM invitation WHERE assessment_survey_id = ?", sid);
  if (responses || codes || invitations) {
    const at = nowIso(ctx);
    await ctx.db.prepare("UPDATE assessment_survey SET state = 'archived', archived_at = ?, collection_status = 'closed' WHERE id = ?").bind(at, sid).run();
    return { result: { id: sid, archived: true, preserved_responses: responses, preserved_codes: codes, preserved_invitations: invitations, undo: null }, scope: { type: "assessment", id: aid }, priorState: { state: row.state, archived_at: row.archived_at } };
  }
  await ctx.db.prepare("DELETE FROM assessment_survey WHERE id = ?").bind(sid).run();
  return { result: { id: sid, deselected: true, preserved_responses: 0 }, scope: { type: "assessment", id: aid }, priorState: { survey: row } };
}, "deselect");
var get_status = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params), row = await survey(ctx, aid, sid);
  const counts = await ctx.db.prepare("SELECT COUNT(*) AS responses, COUNT(DISTINCT respondent_id) AS respondents FROM response WHERE assessment_survey_id = ?").bind(sid).first();
  const t = await loadTemplate(ctx, row.template_id, row.template_version);
  return { result: { survey: { ...row, template_name: t.name, perspective: t.perspective }, counts: { responses: Number(counts?.responses ?? 0), respondents: Number(counts?.respondents ?? 0) } }, scope: { type: "assessment", id: aid } };
}, "get_status");
var print = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params), row = await survey(ctx, aid, sid, "member");
  const t = await loadTemplate(ctx, row.template_id, row.template_version);
  const lang = typeof params.lang === "string" && params.lang ? params.lang : "en";
  const items = renderItems(parseItems(t), lang);
  const esc = /* @__PURE__ */ __name((s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c), "esc");
  const html = `<!doctype html><html lang="${esc(lang)}"><meta charset="utf-8"><title>${esc(t.name)}</title><style>@media print{button{display:none}}body{font:16px system-ui;max-width:48rem;margin:2rem auto}li{margin:1.5rem 0}</style><h1>${esc(t.name)}</h1><ol>${items.map((i) => `<li>${esc(String(i.text))}<hr></li>`).join("")}</ol></html>`;
  return { result: { html, content_type: "text/html; charset=utf-8", template_id: t.id, template_version: t.version, blank: true }, scope: { type: "assessment", id: aid } };
}, "print");
var issue_link = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params);
  await survey(ctx, aid, sid, "member");
  const invitee_hash = typeof params.invitee_hash === "string" ? params.invitee_hash : null;
  const id2 = newId("invite"), token = randomToken("link"), at = nowIso(ctx);
  await ctx.db.prepare("INSERT INTO invitation (id,scope_type,scope_id,assessment_survey_id,role,invitee_hash,token_hash,status,created_by,created_at) VALUES (?, 'survey', ?, ?, 'participant', ?, ?, 'pending', ?, ?)").bind(id2, sid, sid, invitee_hash, await sha2563(token), ctx.principal.id, at).run();
  return { result: { id: id2, status: "pending", sent: false }, scope: { type: "assessment", id: aid } };
}, "issue_link");
var send_links = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  const { aid, sid } = ids(params);
  await survey(ctx, aid, sid, "member");
  const invitationIds = params.ids;
  if (!Array.isArray(invitationIds) || invitationIds.length === 0 || invitationIds.some((x) => typeof x !== "string")) throw new CapError("INVALID_PARAMS", "ids must be a nonempty invitation id array");
  const impact = { affected: invitationIds.map((id2) => ({ invitation: id2 })), irreversible: true, effect: "external", compensating_control: "cap.survey.revoke_link" };
  if (opts?.dryRun) return { result: { accepted: false, count: invitationIds.length }, scope: { type: "assessment", id: aid }, impact };
  throw new CapError("RESERVED_NOT_BUILT", "link delivery is not configured", "No mail transport; prepared links remain unsent");
}, "send_links");
var issue_codes = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params);
  await survey(ctx, aid, sid, "member");
  throw new CapError("RESERVED_NOT_BUILT", "secure code release is not implemented", "Requires encrypted-at-rest escrow or one-time confirmed disclosure");
}, "issue_codes");
var export_codes = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  const { aid, sid } = ids(params);
  await survey(ctx, aid, sid, "member");
  const count = await countScalar(ctx, "SELECT COUNT(*) AS n FROM access_code WHERE assessment_survey_id = ? AND redeemed_at IS NULL", sid);
  const impact = { affected: [{ survey: sid, codes: count }], irreversible: true, effect: "disclosure", compensating_control: "revoke codes" };
  if (opts?.dryRun) return { result: { count }, scope: { type: "assessment", id: aid }, impact };
  throw new CapError("RESERVED_NOT_BUILT", "secure code export is not implemented", "Requires one-time confirmed disclosure or encrypted escrow");
}, "export_codes");
var revoke_link = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params);
  await survey(ctx, aid, sid, "member");
  const id2 = reqStr(params, "id");
  const row = await ctx.db.prepare("SELECT id,status FROM invitation WHERE id = ? AND assessment_survey_id = ?").bind(id2, sid).first();
  if (!row) throw notVisible("link");
  await ctx.db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind(id2).run();
  return { result: { id: id2, status: "revoked" }, scope: { type: "assessment", id: aid }, priorState: { status: row.status } };
}, "revoke_link");
var revoke_code = /* @__PURE__ */ __name(async (ctx, params) => {
  const { aid, sid } = ids(params);
  await survey(ctx, aid, sid, "member");
  const id2 = reqStr(params, "id");
  const row = await ctx.db.prepare("SELECT id,redeemed_at FROM access_code WHERE id = ? AND assessment_survey_id = ?").bind(id2, sid).first();
  if (!row) throw notVisible("code");
  if (row.redeemed_at) throw new CapError("INVALID_PARAMS", "redeemed code cannot be revoked", "revoke participant session instead");
  await ctx.db.prepare("DELETE FROM access_code WHERE id = ?").bind(id2).run();
  return { result: { id: id2, revoked: true }, scope: { type: "assessment", id: aid } };
}, "revoke_code");
var handlers6 = {
  "cap.survey.select": select,
  "cap.survey.deselect": deselect,
  "cap.survey.get_status": get_status,
  "cap.survey.print": print,
  "cap.survey.issue_link": issue_link,
  "cap.survey.send_links": send_links,
  "cap.survey.issue_codes": issue_codes,
  "cap.survey.export_codes": export_codes,
  "cap.survey.revoke_link": revoke_link,
  "cap.survey.revoke_code": revoke_code
};

// src/handlers/participant.ts
async function ensureSurveyOpen(ctx, surveyId, allowClosed = false) {
  const survey2 = await ctx.db.prepare("SELECT s.id, s.state, s.collection_status FROM assessment_survey s WHERE s.id = ?").bind(surveyId).first();
  if (!survey2) throw notVisible("invitation");
  if (survey2.state !== "selected" || !allowClosed && survey2.collection_status !== "open") throw new CapError("STAGE_CONFLICT", "survey is not collecting responses");
}
__name(ensureSurveyOpen, "ensureSurveyOpen");
async function issue(ctx, surveyId, respondentId, allowClosed = false) {
  await ensureSurveyOpen(ctx, surveyId, allowClosed);
  const token = randomToken("pt");
  await ctx.db.prepare("INSERT INTO participant_session (id, assessment_survey_id, respondent_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(newId("ps"), surveyId, respondentId, await sha2563(token), nowIso(ctx), new Date(ctx.now().getTime() + 12 * 36e5).toISOString()).run();
  return { result: { participant_token: token, survey_id: surveyId, expires_in: 43200 }, scope: { type: "survey", id: surveyId } };
}
__name(issue, "issue");
var redeem_code = /* @__PURE__ */ __name(async (ctx, params) => {
  const code = reqStr(params, "code").trim().toUpperCase();
  const row = await ctx.db.prepare("SELECT id, assessment_survey_id, expires_at, redeemed_at, respondent_id FROM access_code WHERE code_hash = ?").bind(await sha2563(code)).first();
  if (!row || row.redeemed_at || row.expires_at && row.expires_at <= nowIso(ctx)) throw notVisible("access code");
  await ensureSurveyOpen(ctx, row.assessment_survey_id);
  const respondentId = row.respondent_id ?? newId("respondent");
  const changed = await ctx.db.prepare("UPDATE access_code SET redeemed_at = ?, respondent_id = ? WHERE id = ? AND redeemed_at IS NULL").bind(nowIso(ctx), respondentId, row.id).run();
  if (changed.meta.changes !== 1) throw notVisible("access code");
  return issue(ctx, row.assessment_survey_id, respondentId);
}, "redeem_code");
var open_link = /* @__PURE__ */ __name(async (ctx, params) => {
  const token = reqStr(params, "token");
  const row = await ctx.db.prepare("SELECT id, scope_type, assessment_survey_id, expires_at, status FROM invitation WHERE token_hash = ?").bind(await sha2563(token)).first();
  if (!row || row.scope_type !== "survey" || !row.assessment_survey_id || row.expires_at && row.expires_at <= nowIso(ctx) || !["pending", "accepted"].includes(row.status)) throw notVisible("invitation");
  const respondentId = `invitee_${row.id}`;
  return issue(ctx, row.assessment_survey_id, respondentId, true);
}, "open_link");
var handlers7 = {
  "cap.participant.redeem_code": redeem_code,
  "cap.participant.open_link": open_link
};

// src/handlers/response.ts
async function scopedSurvey(ctx, requireOpen = false) {
  if (ctx.principal.kind !== "participant" || !ctx.principal.participantSurveyId || !ctx.principal.respondentId)
    throw new CapError("NOT_AUTHENTICATED", "participant token required");
  const s = await ctx.db.prepare(`SELECT s.*, a.name, a.period, l.name AS language_name,
    t.items_json, t.scoring_json, t.perspective, t.source_ref, t.published_at
    FROM assessment_survey s JOIN assessment a ON a.id = s.assessment_id
    JOIN language l ON l.id = a.language_id
    JOIN survey_template t ON t.id = s.template_id AND t.version = s.template_version
    WHERE s.id = ?`).bind(ctx.principal.participantSurveyId).first();
  if (!s) throw notVisible("survey");
  if (requireOpen && (s.state !== "selected" || s.collection_status !== "open"))
    throw new CapError("STAGE_CONFLICT", "survey is not collecting responses");
  return s;
}
__name(scopedSurvey, "scopedSurvey");
function validateAnswers(items, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CapError("INVALID_PARAMS", "answers must be an object");
  const answers = value;
  const ids2 = new Set(items.map((i) => i.id));
  for (const key of Object.keys(answers)) if (!ids2.has(key)) throw new CapError("INVALID_PARAMS", `unknown answer item ${key}`);
  for (const item of items) {
    const answer = answers[item.id];
    if (answer === void 0 || answer === null || answer === "") throw new CapError("INVALID_PARAMS", `answer required for ${item.id}`);
    if (item.type === "scale" && (typeof answer !== "number" || !Number.isInteger(answer) || !item.scale || answer < item.scale.min || answer > item.scale.max))
      throw new CapError("INVALID_PARAMS", `invalid scale answer for ${item.id}`);
    if (item.type === "text" && (typeof answer !== "string" || answer.length > 5e3))
      throw new CapError("INVALID_PARAMS", `invalid text answer for ${item.id}`);
    if (item.type === "single" && (typeof answer !== "string" || !item.options?.some((o) => o.code === answer)))
      throw new CapError("INVALID_PARAMS", `invalid option for ${item.id}`);
    if (item.type === "multi" && (!Array.isArray(answer) || answer.length === 0 || item.max_select && answer.length > item.max_select || new Set(answer).size !== answer.length || !answer.every((a) => typeof a === "string" && item.options?.some((o) => o.code === a))))
      throw new CapError("INVALID_PARAMS", `invalid options for ${item.id}`);
  }
  return answers;
}
__name(validateAnswers, "validateAnswers");
var form = /* @__PURE__ */ __name(async (ctx) => {
  const s = await scopedSurvey(ctx, true);
  const items = parseItems(s);
  if (!items.length) throw new CapError("STAGE_CONFLICT", "survey instrument is unavailable");
  return { result: {
    survey_id: s.id,
    assessment: s.name,
    language: s.language_name,
    period: s.period,
    template: { id: s.template_id, version: s.template_version, perspective: s.perspective, source_ref: s.source_ref },
    items: renderItems(items, s.language_name),
    participant_labels: participantLabels(s.template_id)
  }, scope: { type: "survey", id: s.id } };
}, "form");
var submit = /* @__PURE__ */ __name(async (ctx, params) => {
  const s = await scopedSurvey(ctx, true);
  const idempotencyKey = reqStr(params, "idempotency_key");
  if (idempotencyKey.length > 200) throw new CapError("INVALID_PARAMS", "idempotency_key is too long");
  const respondentId = ctx.principal.respondentId;
  const prior = await ctx.db.prepare("SELECT id, assessment_survey_id, respondent_id, submitted_at FROM response WHERE assessment_survey_id = ? AND idempotency_key = ?").bind(s.id, idempotencyKey).first();
  if (prior) {
    if (prior.respondent_id !== respondentId || prior.assessment_survey_id !== s.id) throw new CapError("INVALID_PARAMS", "idempotency key already used");
    return { result: { response_id: prior.id, submitted_at: prior.submitted_at, duplicate: true, undo: null }, scope: { type: "survey", id: s.id } };
  }
  const existing = await ctx.db.prepare("SELECT id FROM response WHERE assessment_survey_id = ? AND respondent_id = ? LIMIT 1").bind(s.id, respondentId).first();
  if (existing) throw new CapError("STAGE_CONFLICT", "response already submitted; amendment policy is held (D6)");
  const items = parseItems(s);
  if (!items.length) throw new CapError("STAGE_CONFLICT", "survey instrument is unavailable");
  const answers = validateAnswers(items, params.answers);
  const responseId = newId("resp");
  const submittedAt = nowIso(ctx);
  await ctx.db.prepare(`INSERT INTO response
    (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, template_id, template_version, provenance_json, source, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    responseId,
    s.id,
    respondentId,
    idempotencyKey,
    JSON.stringify(answers),
    s.template_id,
    s.template_version,
    JSON.stringify({ presented_template_id: s.template_id, presented_template_version: s.template_version, trace_id: ctx.traceId }),
    "participant",
    submittedAt
  ).run();
  return { result: { response_id: responseId, submitted_at: submittedAt, duplicate: false, undo: null }, scope: { type: "survey", id: s.id } };
}, "submit");
var receipt = /* @__PURE__ */ __name(async (ctx) => {
  const s = await scopedSurvey(ctx);
  const row = await ctx.db.prepare("SELECT id, submitted_at, template_id, template_version FROM response WHERE assessment_survey_id = ? AND respondent_id = ? ORDER BY submitted_at DESC LIMIT 1").bind(s.id, ctx.principal.respondentId).first();
  return { result: {
    submitted: !!row,
    response_id: row?.id ?? null,
    submitted_at: row?.submitted_at ?? null,
    template: row ? { id: row.template_id, version: row.template_version } : null
  }, scope: { type: "survey", id: s.id } };
}, "receipt");
var assisted_next = /* @__PURE__ */ __name(async (ctx) => {
  const s = await scopedSurvey(ctx, true);
  throw new CapError("STAGE_CONFLICT", "assisted collector authorization is not established (D6)", s.id);
}, "assisted_next");
async function assessmentGrant(ctx, aid, min) {
  const a = await ctx.db.prepare("SELECT id FROM assessment WHERE id = ?").bind(aid).first();
  if (!a) throw notVisible("assessment");
  gate(await roleAt2(ctx, "assessment", aid), min, "assessment");
}
__name(assessmentGrant, "assessmentGrant");
var list5 = /* @__PURE__ */ __name(async (ctx, params) => {
  const aid = reqStr(params, "aid");
  await assessmentGrant(ctx, aid, "member");
  return { result: { suppressed: true, status: "held", reason: "D7 disclosure policy unresolved", responses: [] }, scope: { type: "assessment", id: aid } };
}, "list");
var purge = /* @__PURE__ */ __name(async (ctx, params, opts) => {
  const aid = reqStr(params, "aid");
  await assessmentGrant(ctx, aid, "owner");
  const impact = {
    affected: [{ assessment_id: aid, records: "responses" }],
    irreversible: true,
    effect: "destructive",
    retention: "D5 retention policy unresolved; execution held"
  };
  if (opts?.dryRun) return { result: { held: true }, scope: { type: "assessment", id: aid }, impact };
  throw new CapError("STAGE_CONFLICT", "response purge held until D5 retention policy is decided");
}, "purge");
var handlers8 = {
  "cap.response.form": form,
  "cap.response.submit": submit,
  "cap.response.receipt": receipt,
  "cap.response.assisted_next": assisted_next,
  "cap.response.list": list5,
  "cap.response.purge": purge
};

// src/handlers/results.ts
var summary = /* @__PURE__ */ __name(async (ctx, params) => {
  const aid = reqStr(params, "aid");
  const assessment2 = await ctx.db.prepare("SELECT id, stage FROM assessment WHERE id = ?").bind(aid).first();
  if (!assessment2) throw notVisible("assessment");
  gate(await roleAt2(ctx, "assessment", aid), "viewer", "assessment");
  return { result: {
    assessment_id: aid,
    suppressed: true,
    status: "held",
    reason: "D7 scoring, threshold, and differencing policy unresolved",
    summary: null,
    snapshot_version: null,
    algorithm_version: null,
    policy_version: "D7-held"
  }, scope: { type: "assessment", id: aid } };
}, "summary");
var handlers9 = { "cap.results.summary": summary };

// src/handlers/grant.ts
var INVITE_TTL_S = 7 * 24 * 3600;
async function callerAt(ctx, scope, min) {
  return gate(await roleAt2(ctx, scope.type, scope.id), min, scope.type);
}
__name(callerAt, "callerAt");
function ceiling(caller, target, what) {
  if (caller !== "owner" && ROLE_RANK[target] > ROLE_RANK["member"])
    throw new CapError("NOT_AUTHORIZED_AT_SCOPE", `members ${what} up to member only`, "D3 \u2014 ask an owner, or invite as member");
}
__name(ceiling, "ceiling");
async function owners(ctx, scope) {
  const r = await ctx.db.prepare('SELECT principal_id FROM "grant" WHERE scope_type = ? AND scope_id = ? AND role = ?').bind(scope.type, scope.id, "owner").all();
  return r.results.map((x) => x.principal_id);
}
__name(owners, "owners");
var invite = /* @__PURE__ */ __name(async (ctx, p, o) => {
  const scope = reqScope(p);
  const role = reqRole(p);
  const email = reqStr(p, "email").toLowerCase();
  const caller = await callerAt(ctx, scope, "member");
  ceiling(caller, role, "invite");
  const inviteeHash = await sha2563(email);
  const impact = { affected: [{ scope, role, invitee: inviteeHash.slice(0, 12), will_see: `${scope.type} contents at role ${role}` }], irreversible: true, effect: "external", compensating_control: "cap.grant.revoke_invitation (does not unsend)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  const id2 = newId("inv");
  const token = randomToken("il");
  await ctx.db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id2, scope.type, scope.id, inviteeHash, await sha2563(token), role, "sent", ctx.principal.id, nowIso(ctx), new Date(ctx.now().getTime() + INVITE_TTL_S * 1e3).toISOString()).run();
  return { result: { invitation_id: id2, role, status: "sent", accepted: true, delivered: false, note: "phase 0: no mail transport; delivered=false is honest", ...ctx.env.ENVIRONMENT === "dev" ? { dev_only_link_token: token } : {} }, scope, impact };
}, "invite");
var revoke_invitation = /* @__PURE__ */ __name(async (ctx, p) => {
  const id2 = reqStr(p, "id");
  const inv = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status FROM invitation WHERE id = ?").bind(id2).first();
  if (!inv) throw notVisible("invitation");
  const scope = { type: inv.scope_type, id: inv.scope_id };
  const caller = await callerAt(ctx, scope, "member");
  ceiling(caller, inv.role, "revoke invitations");
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "already accepted \u2014 revoke the grant instead", void 0, "cap.grant.revoke");
  await ctx.db.prepare("UPDATE invitation SET status = 'revoked' WHERE id = ?").bind(id2).run();
  return { result: { id: id2, status: "revoked" }, scope };
}, "revoke_invitation");
var accept = /* @__PURE__ */ __name(async (ctx, p, o) => {
  if (ctx.principal.kind !== "user") throw new CapError("NOT_AUTHENTICATED", "sign in to accept an invitation");
  const token = reqStr(p, "token");
  const inv = await ctx.db.prepare("SELECT id, scope_type, scope_id, role, status, expires_at FROM invitation WHERE token_hash = ?").bind(await sha2563(token)).first();
  if (!inv || inv.status === "revoked") throw notVisible("invitation");
  if (inv.status === "accepted") throw new CapError("INVALID_PARAMS", "invitation_used", "ask for a new invitation");
  if (inv.expires_at && inv.expires_at < nowIso(ctx)) throw new CapError("INVALID_PARAMS", "invitation_expired", "ask for a new invitation");
  const scope = { type: inv.scope_type, id: inv.scope_id };
  const existing = await roleAt2(ctx, scope.type, scope.id);
  const impact = { affected: [{ scope, role: inv.role, currently: existing ?? "none" }], irreversible: true, effect: "disclosure", compensating_control: "cap.grant.revoke (what was seen stays seen)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  const role = existing && ROLE_RANK[existing] > ROLE_RANK[inv.role] ? existing : inv.role;
  await ctx.db.batch([
    ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(principal_id, scope_type, scope_id) DO UPDATE SET role = excluded.role').bind(newId("grant"), ctx.principal.id, scope.type, scope.id, role, nowIso(ctx)),
    ctx.db.prepare("UPDATE invitation SET status = 'accepted', accepted_at = ? WHERE id = ?").bind(nowIso(ctx), inv.id)
  ]);
  return { result: { granted: true, scope, role }, scope, impact };
}, "accept");
var list6 = /* @__PURE__ */ __name(async (ctx, p) => {
  const scope = reqScope(p);
  await callerAt(ctx, scope, "member");
  const r = await ctx.db.prepare('SELECT id, principal_id, role, created_at FROM "grant" WHERE scope_type = ? AND scope_id = ? ORDER BY created_at').bind(scope.type, scope.id).all();
  const inv = await ctx.db.prepare("SELECT id, role, status, created_at, expires_at FROM invitation WHERE scope_type = ? AND scope_id = ? AND status IN ('sent','pending') ORDER BY created_at").bind(scope.type, scope.id).all();
  return { result: { scope, grants: r.results, pending_invitations: inv.results }, scope };
}, "list");
var update_role = /* @__PURE__ */ __name(async (ctx, p, o) => {
  const scope = reqScope(p);
  const gid = reqStr(p, "gid");
  const role = reqRole(p);
  await callerAt(ctx, scope, "owner");
  const g = await ctx.db.prepare('SELECT id, principal_id, role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first();
  if (!g) throw notVisible("grant");
  if (g.role === "owner" && role !== "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be demoted", "D3 \u2014 transfer ownership instead (cap.grant.transfer_owner)");
  const impact = { affected: [{ grant: gid, from: g.role, to: role }], irreversible: ROLE_RANK[role] > ROLE_RANK[g.role], effect: "disclosure", compensating_control: "demotion via this capability (what was seen stays seen)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  await ctx.db.prepare('UPDATE "grant" SET role = ? WHERE id = ?').bind(role, gid).run();
  return { result: { grant: gid, role }, scope, impact, priorState: { role: g.role } };
}, "update_role");
var revoke = /* @__PURE__ */ __name(async (ctx, p) => {
  const scope = reqScope(p);
  const gid = reqStr(p, "gid");
  const caller = await callerAt(ctx, scope, "member");
  const g = await ctx.db.prepare('SELECT id, principal_id, role FROM "grant" WHERE id = ? AND scope_type = ? AND scope_id = ?').bind(gid, scope.type, scope.id).first();
  if (!g) throw notVisible("grant");
  if (g.role === "owner") throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "owners cannot be removed", "D3 \u2014 last owner is protected; transfer ownership first");
  ceiling(caller, g.role, "revoke grants");
  await ctx.db.prepare('DELETE FROM "grant" WHERE id = ?').bind(gid).run();
  return { result: { grant: gid, revoked: true }, scope };
}, "revoke");
var transfer_owner = /* @__PURE__ */ __name(async (ctx, p, o) => {
  const scope = reqScope(p);
  const to = reqStr(p, "to");
  if (ctx.principal.kind === "support" && await roleAt2(ctx, scope.type, scope.id) !== "owner")
    throw new CapError("NOT_AUTHORIZED_AT_SCOPE", "transfer by support without the owner's consent is not ruled", "proposed, pending source \u2014 the owner runs this step");
  await callerAt(ctx, scope, "owner");
  if (!await ctx.db.prepare("SELECT id FROM principal WHERE id = ?").bind(to).first()) throw new CapError("INVALID_PARAMS", "unknown principal", "to must be a signed-up principal id");
  const current = await owners(ctx, scope);
  const stepDown = p.step_down === true;
  const impact = { affected: [{ scope, current_owners: current.length, to, to_becomes: "owner", caller_becomes: stepDown ? "member" : "owner" }], irreversible: true, effect: "disclosure", compensating_control: "transfer back (requires the new owner)" };
  if (o?.dryRun) return { result: {}, scope, impact };
  const stmts = [ctx.db.prepare('INSERT INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(principal_id, scope_type, scope_id) DO UPDATE SET role = ?').bind(newId("grant"), to, scope.type, scope.id, "owner", nowIso(ctx), "owner")];
  if (stepDown) stmts.push(ctx.db.prepare('UPDATE "grant" SET role = ? WHERE principal_id = ? AND scope_type = ? AND scope_id = ?').bind("member", ctx.principal.id, scope.type, scope.id));
  await ctx.db.batch(stmts);
  return { result: { transferred: true, scope, new_owner: to, caller_role: stepDown ? "member" : "owner" }, scope, impact };
}, "transfer_owner");
var handlers10 = {
  "cap.grant.invite": invite,
  "cap.grant.revoke_invitation": revoke_invitation,
  "cap.grant.accept": accept,
  "cap.grant.list": list6,
  "cap.grant.update_role": update_role,
  "cap.grant.revoke": revoke,
  "cap.grant.transfer_owner": transfer_owner
};

// src/handlers/request.ts
var KINDS = ["workspace", "project", "access"];
var create4 = /* @__PURE__ */ __name(async (ctx, p) => {
  const principal = requireUser(ctx);
  const kind = reqStr(p, "kind");
  if (!KINDS.includes(kind)) throw new CapError("INVALID_PARAMS", `kind must be one of ${KINDS.join(", ")}`, "kind");
  const target = reqStr(p, "target");
  const scope_type = typeof p.scope_type === "string" ? p.scope_type : null;
  const scope_id = typeof p.scope_id === "string" ? p.scope_id : null;
  const existing = await ctx.db.prepare("SELECT id, created_at FROM request WHERE principal_id = ? AND kind = ? AND status = 'pending' AND json_extract(details_json, '$.target') = ?").bind(principal, kind, target).first();
  if (existing) return { result: { request_id: existing.id, status: "pending", idempotent: true, created_at: existing.created_at }, scope: { type: "platform", id: "requests" } };
  const id2 = newId("req");
  await ctx.db.prepare("INSERT INTO request (id, principal_id, kind, scope_type, scope_id, details_json, status, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id2, principal, kind, scope_type, scope_id, JSON.stringify({ target, note: typeof p.note === "string" ? p.note.slice(0, 500) : null }), "pending", nowIso(ctx)).run();
  return { result: { request_id: id2, status: "pending", idempotent: false, visible_to: "KCS support" }, scope: { type: "platform", id: "requests" } };
}, "create");
var handlers11 = { "cap.request.create": create4 };

// src/handlers/support.ts
var unlock_participant = /* @__PURE__ */ __name(async (ctx, p) => {
  requireSupport(ctx);
  if (p.reason === void 0) throw new CapError("INVALID_PARAMS", "reason required", "support actions carry a reason for the audit row");
  const codeId = reqStr(p, "code_id");
  const old = await ctx.db.prepare("SELECT id, assessment_survey_id, redeemed_at FROM access_code WHERE id = ?").bind(codeId).first();
  if (!old) throw notVisible("code");
  const survey2 = await ctx.db.prepare("SELECT id, assessment_id FROM assessment_survey WHERE id = ?").bind(old.assessment_survey_id).first();
  if (!survey2) throw notVisible("survey");
  const newId_ = newId("code");
  const value = randomCode();
  const stmts = [ctx.db.prepare("INSERT INTO access_code (id, assessment_survey_id, code_hash, created_at) VALUES (?,?,?,?)").bind(newId_, survey2.id, await sha2563(value), nowIso(ctx))];
  if (!old.redeemed_at) stmts.push(ctx.db.prepare("DELETE FROM access_code WHERE id = ?").bind(old.id));
  await ctx.db.batch(stmts);
  const scope = { type: "assessment", id: survey2.assessment_id };
  const audit = await auditRow(ctx, "cap.support.unlock_participant", scope, { old_code: old.id, new_code: newId_, old_was_redeemed: !!old.redeemed_at, support_actor: ctx.principal.supportActor ?? ctx.principal.id });
  return { result: { old_code: old.id, old_revoked: !old.redeemed_at, new_code_id: newId_, sid: survey2.id, aid: survey2.assessment_id, value_via: "cap.survey.export_codes (confirmed disclosure)", audit }, scope };
}, "unlock_participant");
var handlers12 = { "cap.support.unlock_participant": unlock_participant };

// src/handlers/index.ts
var handlers = {
  "cap.entry.intents": entryIntents,
  "cap.entry.example": entryExample,
  "cap.auth.request_link": authRequestLink,
  "cap.auth.consume_link": authConsumeLink,
  "cap.auth.logout": authLogout,
  "cap.auth.me": authMe,
  "cap.ops.health": opsHealth,
  "cap.ops.feedback": opsFeedback,
  "cap.ops.trace": opsTrace,
  "cap.ops.undo": opsUndo,
  "cap.docs.get": docs,
  "cap.docs.capabilities": docsCapabilities,
  "cap.docs.openapi": docsOpenapi,
  // Lane A domain handlers. Unlisted capabilities remain honest 501s.
  ...handlers2,
  ...handlers3,
  ...handlers4,
  ...handlers5,
  ...handlers6,
  ...handlers7,
  ...handlers8,
  ...handlers9,
  // Lane B (Fable) — per #14 c5704577820
  ...handlers10,
  ...handlers11,
  ...handlers12
};

// src/dispatch.ts
var reserved = /* @__PURE__ */ __name((id2, traceId) => fail("RESERVED_NOT_BUILT", "not built yet (phase 0)", "This capability is documented but unavailable in phase 0.", id2, traceId), "reserved");
async function execute(ctx, capabilityId, params, options = {}) {
  const spans = [];
  const log = ctx.log;
  ctx.log = (span, data) => {
    spans.push({ span, t: ctx.now().getTime(), data });
    log(span, data);
  };
  let outcome;
  try {
    if (!params || typeof params !== "object" || Array.isArray(params))
      throw new CapError("INVALID_PARAMS", "params must be an object");
    const cap = byId.get(capabilityId);
    if (!cap) throw new CapError("INVALID_PARAMS", "unknown capability", "See the capabilities registry.");
    const expectedTool = toolForClass(cap.class);
    if (options.tool && options.tool !== expectedTool)
      throw new CapError("WRONG_TOOL_FOR_CLASS", `${capabilityId} requires the ${expectedTool} tool`, `Use ${expectedTool}.`, capabilityId);
    if (cap.slice === "v2.1-oct" || !handlers[capabilityId]) return outcome = reserved(capabilityId, ctx.traceId);
    await authorize(ctx, cap, params);
    const danger = expectedTool === "danger";
    const mode = danger ? options.mode : void 0;
    const implicitConfirm = capabilityId === "cap.auth.request_link" && !options.mode;
    if (danger && !implicitConfirm && mode !== "dry_run" && mode !== "execute")
      throw new CapError("INVALID_PARAMS", "danger requires mode dry_run or execute", "Start with dry_run.", capabilityId);
    if (!danger && options.mode) throw new CapError("INVALID_PARAMS", "mode applies only to danger capabilities", void 0, capabilityId);
    const scope = targetScope(cap, params) ?? { type: "platform", id: "global" };
    const intent = danger ? {
      capability: capabilityId,
      params_hash: await paramsHash(params),
      actor: ctx.principal.id,
      scope: `${scope.type}:${scope.id}`,
      revision: sourceSha
    } : void 0;
    if (danger && mode === "execute") {
      if (!options.confirm_token) throw new CapError("CONFIRM_REQUIRED", "confirmation token required", "Call dry_run with the same params first.", capabilityId);
      const check = await checkConfirmToken(ctx.env.SESSION_SECRET, options.confirm_token, intent, ctx.now());
      if (check !== "ok") throw new CapError(check === "expired" ? "CONFIRM_EXPIRED" : "CONFIRM_REQUIRED", "confirmation expired or does not match this intent", "Call dry_run again.", capabilityId);
    }
    const handled = await handlers[capabilityId](ctx, params, danger ? { dryRun: mode === "dry_run" } : void 0);
    if (danger && mode === "dry_run") {
      if (!handled.impact) throw new Error(`dry_run missing impact: ${capabilityId}`);
      const { token, expires_in } = await mintConfirmToken(ctx.env.SESSION_SECRET, intent, ctx.now());
      return outcome = ok(capabilityId, { ...handled.result, impact: handled.impact, confirm_token: token, expires_in }, ctx.traceId);
    }
    const receipt2 = cap.class === "read" ? void 0 : await mintReceipt(ctx, {
      cap,
      scope: handled.scope ?? scope,
      priorState: handled.priorState,
      params,
      result: handled.result,
      mode,
      confirmToken: options.confirm_token
    });
    return outcome = ok(capabilityId, handled.result, ctx.traceId, receipt2);
  } catch (e) {
    if (!(e instanceof CapError || e instanceof CapError)) throw e;
    return outcome = fail(e.code, e.message, e.hint, e instanceof CapError ? e.docs : void 0, ctx.traceId);
  } finally {
    ctx.log = log;
    await persistTrace(ctx, spans, {
      capability: capabilityId,
      transport: options.transport ?? "http",
      tool: options.tool,
      ok: outcome?.ok ?? false,
      ...!outcome?.ok && outcome ? { code: outcome.error.code } : {}
    });
  }
}
__name(execute, "execute");

// src/mcp.ts
var TOOL_DEFS = [
  {
    name: "docs",
    description: "Front door. No args \u2192 orientation (what 3D Review is, the four tools, auth, capability index, your roles). {capability} \u2192 that capability's page. {topic} \u2192 glossary | permissions | reversibility | telemetry | privacy | stages. {role, scope} \u2192 what you can do here. {q} \u2192 search. Role-aware, never role-leaking.",
    inputSchema: { type: "object", properties: { capability: { type: "string" }, topic: { type: "string" }, role: { type: "string" }, scope: { type: "object", properties: { type: { type: "string" }, id: { type: "string" } } }, q: { type: "string" } } }
  },
  {
    name: "read",
    description: "Execute any class=read capability by id. Same handler, receipt and errors as the HTTP twin.",
    inputSchema: { type: "object", required: ["capability"], properties: { capability: { type: "string" }, params: { type: "object" } } }
  },
  {
    name: "write",
    description: "Execute any class=write.reversible capability; returns a receipt (+ undo_token only when a true inverse is declared). {undo: token} reverses; NO_INVERSE otherwise.",
    inputSchema: { type: "object", properties: { capability: { type: "string" }, params: { type: "object" }, undo: { type: "string" } } }
  },
  {
    name: "danger",
    description: "Execute class=write.dangerous and write.effect capabilities in two steps: mode=dry_run \u2192 impact + confirm_token; mode=execute with confirm_token. Effects (sends, grants, releases) and destructive rows live here. No fifth tool.",
    inputSchema: { type: "object", required: ["capability", "mode"], properties: { capability: { type: "string" }, params: { type: "object" }, mode: { type: "string", enum: ["dry_run", "execute"] }, confirm_token: { type: "string" } } }
  }
];
var rpc = /* @__PURE__ */ __name((id2, result, error) => ({ jsonrpc: "2.0", id: id2, ...error ? { error } : { result } }), "rpc");
async function handleMcp(req, ctx, execute2, docs2) {
  let msg;
  try {
    msg = await req.json();
  } catch {
    return json(rpc(null, void 0, { code: -32700, message: "parse error" }), 400);
  }
  const batch = Array.isArray(msg) ? msg : [msg];
  const out = [];
  for (const m of batch) {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") {
      out.push(rpc(m?.id ?? null, void 0, { code: -32600, message: "invalid request" }));
      continue;
    }
    if (m.id === void 0) continue;
    switch (m.method) {
      case "initialize":
        out.push(rpc(m.id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "3d-review", version: "0.0.1-phase0" },
          instructions: "Call docs with no arguments first. Four tools only (docs/read/write/danger); the split is the permission boundary. Every envelope carries trace_id."
        }));
        break;
      case "ping":
        out.push(rpc(m.id, {}));
        break;
      case "tools/list":
        out.push(rpc(m.id, { tools: TOOL_DEFS }));
        break;
      case "tools/call": {
        const name = m.params?.name;
        const a = m.params?.arguments ?? {};
        if (!tools.includes(name)) {
          out.push(rpc(m.id, void 0, { code: -32602, message: `unknown tool ${name}; tools are ${tools.join(", ")}` }));
          break;
        }
        let env;
        if (name === "docs") env = await docs2(ctx, a);
        else if (name === "write" && a.undo) env = await execute2(ctx, "cap.ops.undo", { token: a.undo }, { tool: "write", transport: "mcp" });
        else env = await execute2(ctx, a.capability, a.params ?? {}, { tool: name, mode: a.mode, confirm_token: a.confirm_token, transport: "mcp" });
        out.push(rpc(m.id, { content: [{ type: "text", text: JSON.stringify(env) }], structuredContent: env, isError: env?.ok === false }));
        break;
      }
      default:
        out.push(rpc(m.id, void 0, { code: -32601, message: `method not found: ${m.method}` }));
    }
  }
  return json(Array.isArray(msg) ? out : out[0] ?? null, 200);
}
__name(handleMcp, "handleMcp");
var json = /* @__PURE__ */ __name((b, status) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } }), "json");

// src/index.ts
import openapiText from "./e8ebc59450295a1ae6e68a6eeabcebd738b98c03-openapi.yaml";
var app = new Hono2();
var json2 = /* @__PURE__ */ __name((value, status) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" }
}), "json");
async function contextForRequest(req, env) {
  return {
    env,
    db: env.DB,
    principal: await resolvePrincipal(req, env),
    traceId: newTraceId(),
    now: /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now"),
    log: /* @__PURE__ */ __name(() => {
    }, "log")
  };
}
__name(contextForRequest, "contextForRequest");
for (const cap of capabilities) {
  if (cap.tool === "danger" && cap.http.method.toUpperCase() === "GET")
    throw new Error(`danger twin cannot be GET: ${cap.id}`);
  const path = cap.http.path.replace("{id}@{ver}", ":idVersion").replace(/\{([^}]+)\}/g, ":$1");
  app.on(cap.http.method.toUpperCase(), path, async (c) => {
    const ctx = await contextForRequest(c.req.raw, c.env);
    try {
      let body = {};
      if (!["GET", "HEAD"].includes(c.req.method)) {
        try {
          const raw2 = await c.req.text();
          if (raw2) {
            const parsed = JSON.parse(raw2);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body is not an object");
            body = parsed;
          }
        } catch {
          return json2(fail("INVALID_PARAMS", "JSON object body required", void 0, cap.id, ctx.traceId), 400);
        }
      }
      const routeParams = c.req.param();
      if (typeof routeParams.idVersion === "string") {
        const separator = routeParams.idVersion.lastIndexOf("@");
        if (separator < 1 || separator === routeParams.idVersion.length - 1)
          return json2(fail("INVALID_PARAMS", "template id@version required", void 0, cap.id, ctx.traceId), 400);
        routeParams.id = routeParams.idVersion.slice(0, separator);
        routeParams.ver = routeParams.idVersion.slice(separator + 1);
        delete routeParams.idVersion;
      }
      const params = {
        ...c.req.method === "GET" ? Object.fromEntries(new URL(c.req.url).searchParams) : {},
        ...body.params && typeof body.params === "object" && !Array.isArray(body.params) ? body.params : body,
        ...routeParams
      };
      if (cap.id === "cap.auth.logout") params.__token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.header("cookie")?.match(/session=([^;]+)/)?.[1];
      if (cap.tool === "danger" && !body.params) {
        delete params.mode;
        delete params.confirm_token;
      }
      const result = await execute(ctx, cap.id, params, {
        tool: cap.tool,
        mode: cap.tool === "danger" ? body.mode : void 0,
        confirm_token: cap.tool === "danger" ? body.confirm_token : void 0,
        transport: "http"
      });
      const res = json2(result, result.ok ? 200 : statusFor(result.error.code));
      if (cap.id === "cap.auth.consume_link" && result.ok) res.headers.append("set-cookie", `session=${result.result.session}; HttpOnly; Path=/; SameSite=Lax`);
      if (cap.id === "cap.auth.logout") res.headers.append("set-cookie", "session=; Max-Age=0; Path=/");
      return res;
    } catch (e) {
      if (e instanceof CapError) return json2(fail(e.code, e.message, e.hint, e.docs, ctx.traceId), statusFor(e.code));
      console.error("http.execute.failed", ctx.traceId, String(e));
      return json2(fail("INVALID_PARAMS", "request could not be completed", void 0, cap.id, ctx.traceId), 500);
    }
  });
}
app.post("/mcp", async (c) => {
  const ctx = await contextForRequest(c.req.raw, c.env);
  return handleMcp(c.req.raw, ctx, execute, async (cx, a) => {
    try {
      const r = await docs(cx, a);
      return ok("cap.docs.get", r.result, cx.traceId);
    } catch (e) {
      return fail(e.code ?? "INVALID_PARAMS", e.message, e.hint, "cap.docs.get", cx.traceId);
    }
  });
});
app.get("/v2/openapi.yaml", (c) => c.text(openapiText, 200, { "content-type": "application/yaml" }));
app.notFound((c) => json2(fail("NOT_FOUND_OR_NOT_VISIBLE", "no such route", "GET /v2/capabilities.json lists every route", "cap.docs.capabilities"), 404));
var index_default = app;
export {
  contextForRequest,
  index_default as default
};
//# sourceMappingURL=index.js.map

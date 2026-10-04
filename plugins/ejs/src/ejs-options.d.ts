// @types/ejs is written for EJS 3 and lacks the two options EJS 6 added.
import 'ejs';

declare module 'ejs' {
  interface Options {
    unsafePrototypeLocals?: boolean;
    legacyInclude?: boolean;
  }
}

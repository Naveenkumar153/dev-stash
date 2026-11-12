// Entry point for Monaco's editor worker. `MonacoEditor` starts it with
// `new Worker(new URL(...))`, which the bundler builds as its own chunk.
import "monaco-editor/editor/editor.worker";

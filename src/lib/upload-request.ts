export interface UploadResponse<T> {
  status: number;
  /** The parsed JSON body, or null when the reply wasn't JSON. */
  body: T | null;
}

/**
 * POSTs a form with XMLHttpRequest, since `fetch` can't report upload
 * progress. `onProgress` gets the fraction of the body sent so far, 0 to 1.
 * Rejects only when the request never got a reply, e.g. the network dropped.
 */
export function postFormWithProgress<T>(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<UploadResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });
    xhr.addEventListener("load", () => {
      resolve({ status: xhr.status, body: (xhr.response as T | null) ?? null });
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed: network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.send(form);
  });
}

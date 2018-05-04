export interface Requestor {
  getJSON<T>(url: string, params?: Object): Promise<T>;
  sendJSON<T>(url: string, params?: Object, postData?: Object): Promise<T>;
}

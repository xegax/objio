export interface Encryptor {
  encrypt(s: string): string;
  decrypt(s: string): string;
}

export class EmptyEncryptor implements Encryptor {
  encrypt(s: string): string {
    return s;
  }

  decrypt(s: string): string {
    return s;
  }
}

export class Base64Encryptor implements Encryptor {
  encrypt(s: string): string {
    try {
      return btoa(s);
    } catch(e) {
    }

    return new Buffer(s).toString('base64');
  }

  decrypt(s: string): string {
    try {
      return atob(s);
    } catch(e) {
    }
    
    return new Buffer(s, 'base64').toString();
  }
}

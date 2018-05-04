export class Publisher {
  private observers = Array<() => void>();

  subscribe(o: () => void) {
    this.observers.indexOf(o) == -1 && this.observers.push(o);
  }

  unsubscribe(o: () => void) {
    this.observers.splice(this.observers.indexOf(o), 1);
  }

  notify() {
    this.observers.forEach(notify => {
      try {
        notify();
      } catch (e) {
        console.log(e);
      }
    });
  }
}

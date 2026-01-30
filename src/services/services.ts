import type { AuraConfig } from '#root/config/config.ts';

type ServiceFactoryFn<T> = (container: ServiceContainer) => T | Promise<T>;
type DestroyFn = () => void | Promise<void>;

type ServiceEntry<T> = {
  factory: ServiceFactoryFn<T>;
  instance?: T;
  destroy?: DestroyFn;
};

class ServiceContainer {
  #services = new Map<string, ServiceEntry<unknown>>();
  #destroyCallbacks: DestroyFn[] = [];
  #config: AuraConfig;

  constructor(config: AuraConfig) {
    this.#config = config;
  }

  get config(): AuraConfig {
    return this.#config;
  }

  register = <T>(name: string, factory: ServiceFactoryFn<T>, destroy?: DestroyFn): void => {
    this.#services.set(name, { factory, destroy });
  };

  resolve = async <T>(name: string): Promise<T> => {
    const entry = this.#services.get(name) as ServiceEntry<T> | undefined;
    if (!entry) {
      throw new Error(`Service "${name}" not found`);
    }

    if (entry.instance === undefined) {
      entry.instance = await entry.factory(this);
      if (entry.destroy) {
        this.#destroyCallbacks.push(entry.destroy);
      }
    }

    return entry.instance;
  };

  has = (name: string): boolean => {
    return this.#services.has(name);
  };

  destroy = async (): Promise<void> => {
    for (const callback of this.#destroyCallbacks.reverse()) {
      await callback();
    }
    this.#destroyCallbacks = [];
    this.#services.clear();
  };
}

export type { ServiceFactoryFn, DestroyFn };
export { ServiceContainer };

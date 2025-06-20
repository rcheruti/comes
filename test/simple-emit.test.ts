import { test, vi } from 'vitest';
import { EventSystem, es as defaultES } from '../src/index';

// ------------------------------------------

test(`Test default EventSystem`, async({ expect }) => {
  const ES_EVENT_NAME = 'ES_EVENT_NAME_01';
  defaultES.emit(ES_EVENT_NAME, 'my value');
  const resp = defaultES.get(ES_EVENT_NAME);
  expect(resp.last).toBe('my value');
  expect(resp.date).toBeDefined();
  expect(resp.listeners.length).toBeGreaterThan(-1);
  expect(resp.loader).toBeUndefined();
  expect(resp.loaderProm).toBeUndefined();
});

// ------------------------------------------

test(`Test simple emit and get`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_01';
  es.emit(ES_EVENT_NAME, 'my value');
  const resp = es.get(ES_EVENT_NAME);
  expect(resp.last).toBe('my value');
  expect(resp.date).toBeDefined();
  expect(resp.listeners.length).toBeGreaterThan(-1);
  expect(resp.loader).toBeUndefined();
  expect(resp.loaderProm).toBeUndefined();
});

test(`Test simple emit before and listen after`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_02';
  const Obj = {
    prom: null as null | Promise<any>,
    res: null as null | ((value: any) => void) ,
    func(value: string) {
      expect(value).toBe('my value 02');
      Obj.res!(value);
    },
  };
  const funcSpy = vi.spyOn(Obj, 'func');

  es.emit(ES_EVENT_NAME, 'my value 01');
  es.emit(ES_EVENT_NAME, 'my value 02');

  Obj.prom = new Promise<any>((res,_) => {
    Obj.res = res;
    es.listen(ES_EVENT_NAME, Obj.func);
  });
  await Obj.prom;

  expect(funcSpy).toBeCalledTimes(1);
});

test(`Test simple listen before and emit after`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_03';
  const Obj = {
    prom: null as null | Promise<any>,
    res: null as null | ((value: any) => void) ,
    func(value: string) {
      expect(value === 'my value 01' || value === 'my value 02').toBeTruthy();
      if( value === 'my value 02' ) Obj.res!(value);
    },
  };
  const funcSpy = vi.spyOn(Obj, 'func');

  Obj.prom = new Promise<any>((res,_) => {
    Obj.res = res;
    es.listen(ES_EVENT_NAME, Obj.func);
  });

  es.emit(ES_EVENT_NAME, 'my value 01');
  es.emit(ES_EVENT_NAME, 'my value 02');
  await Obj.prom;

  expect(funcSpy).toBeCalledTimes(2);
});

test(`Test simple unregister`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_04';
  const unregister = es.listen(ES_EVENT_NAME, () => {});
  let data = es.get(ES_EVENT_NAME);
  expect(data.listeners.length).toBe(1);
  unregister();
  expect(data.listeners.length).toBe(0);
});

test(`Test unregister inside listener`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_05';
  es.emit(ES_EVENT_NAME, 'my value');
  const Obj = {
    listener: () => {
      es.unlisten(ES_EVENT_NAME, Obj.listener);
    }
  };
  const funcSpy = vi.spyOn(Obj, 'listener');
  es.listen(ES_EVENT_NAME, Obj.listener);
  expect(funcSpy).toBeCalledTimes(1);
  
  expect(es.get(ES_EVENT_NAME).listeners.length).toBe(0); // removed
  es.emit(ES_EVENT_NAME, 'my value 02');
  expect(funcSpy).toBeCalledTimes(1); // was removed, so not called any more
});

// ------------------------------------------
// Loader behavior

test(`Test loader before listeners`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_01';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.emit(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  es.setLoader(ES_EVENT_NAME, Obj.loader);
  expect(funcSpy).not.toBeCalled();

  es.listen(ES_EVENT_NAME, (value: string) => {
    expect(value).toBe('first value');
    expect(funcSpy).toBeCalled();
  });
});

test(`Test loader after listeners`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_02';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.emit(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  es.listen(ES_EVENT_NAME, (value: string) => {
    expect(value).toBe('first value');
  });
  expect(es.get(ES_EVENT_NAME).listeners.length).toBe(1);

  es.setLoader(ES_EVENT_NAME, Obj.loader);
  
  await new Promise<any>((res) => {
    setTimeout(() => {
      expect(funcSpy).toBeCalled();
      res(null);
    }, 10);
  });
});

test(`Test loader after value and before listeners`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_03';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.emit(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  es.emit(ES_EVENT_NAME, 'other value');

  es.setLoader(ES_EVENT_NAME, Obj.loader);
  expect(funcSpy).not.toBeCalled();
  
  es.listen(ES_EVENT_NAME, (value: string) => {
    expect(value).toBe('other value');
  });
  expect(es.get(ES_EVENT_NAME).listeners.length).toBe(1);
  
  await new Promise<any>((res) => {
    setTimeout(() => {
      expect(funcSpy).not.toBeCalled();
      res(null);
    }, 10);
  });
});

test(`Test loader after value and after listeners`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_04';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.emit(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  es.emit(ES_EVENT_NAME, 'other value');
  es.listen(ES_EVENT_NAME, (value: string) => {
    expect(value).toBe('other value');
  });
  expect(es.get(ES_EVENT_NAME).listeners.length).toBe(1);

  es.setLoader(ES_EVENT_NAME, Obj.loader);
  
  await new Promise<any>((res) => {
    setTimeout(() => {
      expect(funcSpy).not.toBeCalled();
      res(null);
    }, 10);
  });
});

test(`Test load without loader`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_05';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.emit(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');
  // no "setLoader" called
  await es.load(ES_EVENT_NAME);
  expect(funcSpy).not.toBeCalled();
});

test(`Test loader parameters`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_06';
  const Obj = {
    loader: (id: string, stringArg: string, trueArg: boolean, falseArg: boolean, numberArg: number) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(stringArg).toBe('value 01');
      expect(trueArg).toBeTruthy();
      expect(falseArg).toBeFalsy();
      expect(numberArg).toBe(15);
    }
  };
  es.setLoader(ES_EVENT_NAME, Obj.loader);
  await es.load(ES_EVENT_NAME, 'value 01', true, false, 15);
});

test(`Test loader with error, returning a value`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_07';
  const Obj = {
    loader: (id: string) => {
      expect(id).toBe(ES_EVENT_NAME);
      throw 'loader error';
    },
    loaderCatch: async(id: string, ex: any) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(ex).toBe('loader error');
      return 'default value';
    },
    listener: (value: string) => {
      expect(value).toBe('default value');
    }
  };
  const loaderSpy = vi.spyOn(Obj, 'loader');
  const loaderCatchSpy = vi.spyOn(Obj, 'loaderCatch');
  const listenerSpy = vi.spyOn(Obj, 'listener');
  es.setLoader(ES_EVENT_NAME, Obj.loader, Obj.loaderCatch);
  es.listen(ES_EVENT_NAME, Obj.listener);

  await es.get(ES_EVENT_NAME).loaderProm;
  expect(loaderSpy).toBeCalled();
  expect(loaderCatchSpy).toBeCalled();
  expect(listenerSpy).toBeCalled();
});

test(`Test loader with error, throwing an error`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_08';
  const Obj = {
    loader: (id: string) => {
      expect(id).toBe(ES_EVENT_NAME);
      throw new Error('loader error');
    },
    loaderCatch: async(id: string, ex: any) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(ex.message).toBe('loader error');
      throw new Error('loaderCatch error');
    },
    listener: (value: string) => {
      // cannot be called
    }
  };
  const loaderSpy = vi.spyOn(Obj, 'loader');
  const loaderCatchSpy = vi.spyOn(Obj, 'loaderCatch');
  const listenerSpy = vi.spyOn(Obj, 'listener');
  es.setLoaderCatch(ES_EVENT_NAME, Obj.loaderCatch);
  es.setLoader(ES_EVENT_NAME, Obj.loader);
  es.listen(ES_EVENT_NAME, Obj.listener);
  try {
    await es.get(ES_EVENT_NAME).loaderProm;
  } catch(ex: any) {
    expect(ex.message).toBe('loaderCatch error');
    expect(ex.loaderEx.message).toBe('loader error');
    expect(loaderSpy).toBeCalled();
    expect(loaderCatchSpy).toBeCalled();
    expect(listenerSpy).not.toBeCalled();
  }
});

test(`Test loader with error, without a loaderCatch`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_09';
  const Obj = {
    loader: (id: string) => {
      expect(id).toBe(ES_EVENT_NAME);
      throw new Error('loader error');
    },
    listener: (value: string) => {
      // cannot be called
    }
  };
  const loaderSpy = vi.spyOn(Obj, 'loader');
  const listenerSpy = vi.spyOn(Obj, 'listener');
  es.setLoader(ES_EVENT_NAME, Obj.loader);
  es.listen(ES_EVENT_NAME, Obj.listener);
  try {
    await es.get(ES_EVENT_NAME).loaderProm;
  } catch(ex: any) {
    expect(ex.message).toBe('loader error');
    expect(loaderSpy).toBeCalled();
    expect(listenerSpy).not.toBeCalled();
  }
});

test(`Test loader with error, loaderCatch with error, throwing string (native data)`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_07';
  const Obj = {
    loader: (id: string) => {
      expect(id).toBe(ES_EVENT_NAME);
      throw 'loader error';
    },
    loaderCatch: async(id: string, ex: any) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(ex).toBe('loader error');
      throw 'loaderCatch error';
    },
    listener: (value: string) => {
      // cannot be called
    }
  };
  const loaderSpy = vi.spyOn(Obj, 'loader');
  const loaderCatchSpy = vi.spyOn(Obj, 'loaderCatch');
  const listenerSpy = vi.spyOn(Obj, 'listener');
  es.setLoader(ES_EVENT_NAME, Obj.loader, Obj.loaderCatch);
  es.listen(ES_EVENT_NAME, Obj.listener);

  try {
    await es.get(ES_EVENT_NAME).loaderProm;
  } catch(ex: any) {
    expect(ex).toBe('loaderCatch error');
    expect(ex.loaderEx).toBeUndefined();
    expect(loaderSpy).toBeCalled();
    expect(loaderCatchSpy).toBeCalled();
    expect(listenerSpy).not.toBeCalled();
  }
});

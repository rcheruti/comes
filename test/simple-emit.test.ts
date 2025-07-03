import { test, vi } from 'vitest';
import { EventSystem, es as defaultES } from '../src/index';

// ------------------------------------------

test(`Test default EventSystem`, async({ expect }) => {
  const ES_EVENT_NAME = 'ES_EVENT_NAME_01';
  defaultES.send(ES_EVENT_NAME, 'my value');
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
  es.send(ES_EVENT_NAME, 'my value');
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

  es.send(ES_EVENT_NAME, 'my value 01');
  es.send(ES_EVENT_NAME, 'my value 02');

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

  es.send(ES_EVENT_NAME, 'my value 01');
  es.send(ES_EVENT_NAME, 'my value 02');
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
  es.send(ES_EVENT_NAME, 'my value');
  const Obj = {
    listener: () => {
      es.unlisten(ES_EVENT_NAME, Obj.listener);
    }
  };
  const funcSpy = vi.spyOn(Obj, 'listener');
  es.listen(ES_EVENT_NAME, Obj.listener);
  expect(funcSpy).toBeCalledTimes(1);
  
  expect(es.get(ES_EVENT_NAME).listeners.length).toBe(0); // removed
  es.send(ES_EVENT_NAME, 'my value 02');
  expect(funcSpy).toBeCalledTimes(1); // was removed, so not called any more
});

test(`Test listener thrown exception (awaited)`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_06';
  const Obj = {
    listen01: async(event: number) => {
      throw 'Error'
    },
  };
  const listen01Spy = vi.spyOn(Obj, 'listen01');
  es.listen(ES_EVENT_NAME, Obj.listen01);

  try {
    await es.send(ES_EVENT_NAME, 1);
  } catch(err: any) {
    expect(err).toBe('Error');

    let resp = es.get(ES_EVENT_NAME);
    expect(resp.last).toBe(1);
    
    expect(listen01Spy).toBeCalled();
  }
});

test(`Test listener thrown exception (not awaited)`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_07';
  const Obj = {
    listen01: async(event: number) => {
      throw 'Listener Error'
    },
  };
  const listen01Spy = vi.spyOn(Obj, 'listen01');
  es.listen(ES_EVENT_NAME, Obj.listen01);

  let prom: any = null;
  expect(() => prom = es.send(ES_EVENT_NAME, 1)).not.toThrow();
  try {
    await prom;
  } catch(err: any) {
    expect(err).toBe('Listener Error');
  }
});

// ------------------------------------------
// Loader behavior

test(`Test loader before listeners`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_01';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.send(ES_EVENT_NAME, 'first value');
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
      es.send(ES_EVENT_NAME, 'first value');
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
      es.send(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  es.send(ES_EVENT_NAME, 'other value');

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
      es.send(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  es.send(ES_EVENT_NAME, 'other value');
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
      es.send(ES_EVENT_NAME, 'first value');
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

// ------------------------------------------
// ------------------------------------------
// ----- Interceptors

test(`Test simple interceptor`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_INTER_01';
  es.addInter(ES_EVENT_NAME, async(id: string, event: string, es: EventSystem) => {
    expect(id).toBe(ES_EVENT_NAME);
    expect(event).toBe('my value');
    return event + '_2';
  });
  await es.send(ES_EVENT_NAME, 'my value');
  const resp = es.get(ES_EVENT_NAME);
  expect(resp.last).toBe('my value_2'); // changed by interceptor
  expect(resp.date).toBeDefined();
  expect(resp.listeners.length).toBeGreaterThan(-1);
  expect(resp.loader).toBeUndefined();
  expect(resp.loaderProm).toBeUndefined();
});

test(`Test simple interceptor chain`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_INTER_02';
  const Obj = {
    inter01: async(id: string, event: number, es: EventSystem) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(event).toBe(1);
      return event + 1;
    },
    inter02: async(id: string, event: number, es: EventSystem) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(event).toBe(2);
      return event + 1;
    },
    listen01: async(event: number) => {
      expect(event).toBe(3);
    },
  };
  const inter01Spy = vi.spyOn(Obj, 'inter01');
  const inter02Spy = vi.spyOn(Obj, 'inter02');
  const listen01Spy = vi.spyOn(Obj, 'listen01');

  es.addInter(ES_EVENT_NAME, Obj.inter01);
  es.addInter(ES_EVENT_NAME, Obj.inter02);
  es.listen(ES_EVENT_NAME, Obj.listen01);

  await es.send(ES_EVENT_NAME, 1);
  const resp = es.get(ES_EVENT_NAME);
  expect(resp.last).toBe(3); // changed by interceptors
  expect(resp.date).toBeDefined();
  expect(resp.listeners.length).toBeGreaterThan(-1);
  expect(resp.loader).toBeUndefined();
  expect(resp.loaderProm).toBeUndefined();
  
  expect(inter01Spy).toBeCalledTimes(1);
  expect(inter02Spy).toBeCalledTimes(1);
  expect(listen01Spy).toBeCalledTimes(1);
});

test(`Test simple interceptor remove`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_INTER_03';
  const Obj = {
    inter01: async(id: string, event: number, es: EventSystem) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(event).toBe(1);
      return event + 1;
    },
    inter02: async(id: string, event: number, es: EventSystem) => {
      expect(id).toBe(ES_EVENT_NAME);
      expect(event).toBe(2);
      return event + 1;
    },
    listen01: async(event: number) => {
      return event +1;
    },
  };
  const inter01Spy = vi.spyOn(Obj, 'inter01');
  const inter02Spy = vi.spyOn(Obj, 'inter02');
  const listen01Spy = vi.spyOn(Obj, 'listen01');

  es.addInter(ES_EVENT_NAME, Obj.inter01);
  const removeInter02 = es.addInter(ES_EVENT_NAME, Obj.inter02);
  es.listen(ES_EVENT_NAME, Obj.listen01);

  await es.send(ES_EVENT_NAME, 1);
  let resp = es.get(ES_EVENT_NAME);
  expect(resp.last).toBe(3); // changed by interceptors

  removeInter02();
  await es.send(ES_EVENT_NAME, 1);
  resp = es.get(ES_EVENT_NAME);
  expect(resp.last).toBe(2); // changed by interceptors
  
  expect(inter01Spy).toBeCalledTimes(2);
  expect(inter02Spy).toBeCalledTimes(1);
  expect(listen01Spy).toBeCalledTimes(2);
});

test(`Test simple interceptor error`, async({ expect }) => {
  const es = new EventSystem();
  const ES_EVENT_NAME = 'ES_EVENT_INTER_04';
  const Obj = {
    inter01: async(id: string, event: number, es: EventSystem) => {
      throw 'Error';
    },
    listen01: async(event: number) => {
      return event +1;
    },
  };
  const inter01Spy = vi.spyOn(Obj, 'inter01');
  const listen01Spy = vi.spyOn(Obj, 'listen01');

  es.addInter(ES_EVENT_NAME, Obj.inter01);
  es.listen(ES_EVENT_NAME, Obj.listen01);

  try {
    await es.send(ES_EVENT_NAME, 1);
  } catch(err: any) {
    expect(err).toBe('Error');

    let resp = es.get(ES_EVENT_NAME);
    expect(resp.last).toBe(null); // not changed by interceptors
    
    expect(inter01Spy).toBeCalledTimes(1);
    expect(listen01Spy).not.toBeCalled();
  }
});


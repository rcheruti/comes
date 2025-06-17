import { test, vi } from 'vitest';
import { es } from '../src/index';

// ------------------------------------------

test(`Test simple emit and get`, async({ expect }) => {
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
  const ES_EVENT_NAME = 'ES_EVENT_NAME_04';
  const unregister = es.listen(ES_EVENT_NAME, () => {});
  let data = es.get(ES_EVENT_NAME);
  expect(data.listeners.length).toBe(1);
  unregister();
  expect(data.listeners.length).toBe(0);
});

test(`Test unregister inside listener`, async({ expect }) => {
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
  });

  expect(funcSpy).toBeCalled();
});

test(`Test loader after listeners`, async({ expect }) => {
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
  const ES_EVENT_NAME = 'ES_EVENT_NAME_LOADER_05';
  const Obj = {
    loader: (id: string, ...args: any[]) => {
      es.emit(ES_EVENT_NAME, 'first value');
    }
  };
  const funcSpy = vi.spyOn(Obj, 'loader');

  await es.load(ES_EVENT_NAME);
  expect(funcSpy).not.toBeCalled();
});



// -------
/**
 * Function to exclude an item from the array.
 * @param item Item that will be removed
 * @param list Array where to find the item
 */
export function deleteFromArray( item: any, list: any[] ) {
  for( let i = list.length; i > -1; i-- ) {
    let it = list[i];
    if( it === item ) {
      list.splice( i, 1 );
      break;
    }
  }
}

// -------
// Event System

/**
 * Type that holds the value for an event address.
 */
export type ES_ValueType = {
  /**
   * The last value emitted.
   */
  last: any ,
  /**
   * Listeners of this event.
   */
  listeners: ((event: any) => void)[] ,
  /**
   * Last time an event was emitted.  
   * 
   * If this value is "null" or "undefined" so no event/value was emitted yet.  
   * In this case, the "last" field will be "null" or "undefined" also.
   */
  date?: Date,
  /**
   * Loader to run when the first listeners is registered and no event was 
   * emitted yet.
   * 
   * If some event/value was emitted before the first listener registered, so
   * this function will not be called.
   * 
   * @param id The address name of the event
   * @param args Extra parameters to the function
   * @returns void
   */
  loader?: (id: string, ...args: any[])=>void,
  /**
   * Error handler of the loader. If the execution of the loader throw 
   * an Error/Exception then this function will be called with the
   * exception.
   * 
   * This function can be async, and will be awaited.
   * 
   * If this functions returns a value (not undefined), then the loader will
   * resolve successfully with that value.  
   * If this function does not return a value, then loader will reject with the
   * original exception.  
   * If this function throws an exception, then the loader will reject with that exception,
   * and the original exception of the loader will be in the "loaderEx" field of that exception.
   * 
   * @param id The address name of the event
   * @param ex Exception thrown by the loader
   * @returns void
   */
  loaderCatch?: (id: string, ex: Error | any)=>any,

  /**
   * Promise resolved when loader ends execution.
   * If some error occurss then the "loaderCatch" function
   * will be called.
   */
  loaderProm?: Promise<any> ,
};

/**
 * Class that creates the field through which communication will occur.
 */
export class EventSystem {

  /**
   * Each key is an event address and the value is an {@link ES_ValueType} that
   * holds the last value for the address.
   */
  data: { [id: string]: ES_ValueType } = {};

  /**
   * Gets a reference to {@link ES_ValueType} of the address informed.
   * @param id The address name of the event
   */
  get(id: string): ES_ValueType {
    if( !this.data[id] ) this.data[id] = { last: null , listeners: [] };
    return this.data[id];
  }
  /**
   * Sends the value to the listeners of the event address.
   * @param id The address name of the event
   * @param event The value to send to listeners
   * @returns The value informed
   */
  emit<T>(id: string, event: T): T {
    let esData = this.get( id );
    esData.last = event;
    esData.date = new Date();
    for(let func of esData.listeners) func( event );
    return event;
  }
  /**
   * Register a listener for the address.  
   * The listener will receive the last value emitted.  
   * The listener can call {@link get} to get the {@link ES_ValueType} of the type in the start of the function.  
   * 
   * The listener will be called with the last value available in the cache.
   * 
   * @param id The address name of the event
   * @param listener The listener, will be called every time a new value is emitted to this address
   * @returns An unregister function. Use this function to remove the listener
   */
  listen(id: string, listener: (event: any) => void): ()=>void {
    let esData = this.get( id );
    esData.listeners.push( listener );
    if( esData.date ) listener( esData.last );
    else if( esData.loader ) esData.loaderProm = this.load(id);
    return () => this.unlisten( id, listener );
  }
  /**
   * Remove the listener from the list of this event address.  
   * 
   * If you need to remove a listener from the event address inside the exection of
   * the listener, then use this function like so:
   * ```ts
   * const listener = () => {
   *    es.unlisten(ES_EVENT_NAME, listener);
   *    // then do what you need...
   *    // ...
   * };
   * es.listen(ES_EVENT_NAME, listener);
   * ```
   * This is because in some cases the return value of the {@link EventSystem.listen listen}
   * will not be ready to unregister the listener (the variable will not be set yet).
   * 
   * @param id The address name of the event
   * @param listener Listener to remove
   */
  unlisten(id: string, listener: (event: any) => void) {
    let esData = this.get( id );
    deleteFromArray( listener, esData.listeners );
  }
  /**
   * Configure a {@link ES_ValueType.loader loader} to execute when the first listener is registered and no value exists yet.
   * 
   * Remember to configure a Error Handler ({@link ES_ValueType.loaderCatch loaderCatch}) before configuring 
   * the {@link ES_ValueType.loader loader}, or use the 3o argumento to 
   * configure the {@link ES_ValueType.loaderCatch loaderCatch}.
   * 
   * If any listener is registered, and no value was emitted yet, then the loader will
   * be called by this method to fetch the first value of the event address.  
   * 
   * @param id The address name of the event
   * @param loader The function to execute when the first liteners is registered 
   *               and no value exists yet.
   * @param loaderCatch The error handler for exceptions thrown by the {@link ES_ValueType.loader loader}
   */
  setLoader(id: string, loader: ES_ValueType['loader'], loaderCatch?: ES_ValueType['loaderCatch']): void {
    let esData = this.get( id );
    esData.loader = loader;
    if( loaderCatch ) esData.loaderCatch = loaderCatch;
    if( !esData.date && esData.listeners.length ) esData.loaderProm = this.load(id);
  }
  setLoaderCatch(id: string, loaderCatch: ES_ValueType['loaderCatch']) {
    let esData = this.get( id );
    esData.loaderCatch = loaderCatch;
  }
  /**
   * Executes the {@link ES_ValueType.loader loader} for an address.
   * 
   * If some error hapens in the {@link ES_ValueType.loader loader} function, then the {@link ES_ValueType.loaderCatch loaderCatch} will be
   * called with the error (if configured).  
   * Check the {@link ES_ValueType.loaderCatch loaderCatch} docs to understand the behavior. 
   * 
   * @param id The address name of the event
   * @param args Arguments to pass to the {@link ES_ValueType.loader loader}
   * @returns Promise that will resolve when the {@link ES_ValueType.loader loader} resolves
   */
  async load<T>(id: string, ...args: any[]): Promise<() => T> {
    let esData = this.get( id );
    if( !esData.loader ) {
      esData.loaderProm = undefined;
      return esData.last;
    }
    esData.loaderProm = new Promise(async(res, rej) => {
        try {
          await esData.loader!( id, ...args );
          esData.loaderProm = undefined;
          res(esData.last);
        } catch(ex: any) {
          if( esData.loaderCatch ) {
            try {
              const catchRes = await esData.loaderCatch(id, ex);
              if( catchRes !== undefined ) {
                this.emit(id, catchRes);
                res(catchRes);
              }
            } catch(ex2: any) {
              try { ex2.loaderEx = ex; } catch(ex3: any) { /* do nothing */ }
              rej(ex2);
            }
          }
          else rej(ex);
        }
    });
    return esData.loaderProm;
  }
}

/**
 * This "es" is the default EventSystem created.
 */
export const es = new EventSystem();

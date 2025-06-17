
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
   * @param id The address name
   * @param args Extra parameters to the function
   * @returns 
   */
  loader?: (id: string, ...args: any[])=>void,
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
   * @param id The address name
   */
  get(id: string): ES_ValueType {
    if( !this.data[id] ) this.data[id] = { last: null , listeners: [] };
    return this.data[id];
  }
  /**
   * Sends the value to the listeners of the event address.
   * @param id The address name
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
   * @param id The address name 
   * @param listener The listener, will be called every time a new value is emitted to this address
   * @returns An unregister function. Use this function to remove the listener
   */
  listen(id: string, listener: (event: any) => void): ()=>void {
    let esData = this.get( id );
    esData.listeners.push( listener );
    if( esData.date ) listener( esData.last );
    else if( esData.loader ) es.load(id);
    return () => this.unlisten( id, listener );
  }
  unlisten(id: string, listener: (event: any) => void) {
    let esData = this.get( id );
    deleteFromArray( listener, esData.listeners );
  }
  /**
   * Configure a loader to execute when the first listener is registered and no value exists yet.
   * 
   * @param id The address name 
   * @param loader The function to execute when the first liteners is registered 
   *               and no value exists yet.
   */
  setLoader(id: string, loader: ES_ValueType['loader']): void {
    let esData = this.get( id );
    esData.loader = loader;
    if( !esData.date && esData.listeners.length ) this.load(id);
  }
  /**
   * Executes the loader for an address.
   * @param id The address name 
   * @param args Arguments to pass to the loader
   * @returns Promise that will resolve when the loader resolves
   */
  async load<T>(id: string, ...args: any[]): Promise<() => T> {
    let esData = this.get( id );
    if( !esData.loader ) return esData.last;
    esData.loaderProm = new Promise(async(res) => {
        await esData.loader!( id, ...args );
        esData.loaderProm = undefined;
        res(esData.last);
    });
    return esData.loaderProm;
  }
}

/**
 * This "es" is the default EventSystem created.
 */
export const es = new EventSystem();

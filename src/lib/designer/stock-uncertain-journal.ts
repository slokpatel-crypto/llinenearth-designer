// A physical-stock RPC may commit before the browser receives an ACK. Keep a
// tab-scoped, privacy-safe pending bit BEFORE each POST so reload/navigation
// cannot reset the operator reconciliation lock.
type PendingStorage={
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
};
const KEY="linen-earth:stock-uncertain-pending:v1";
const FAILURE="Stock write tracking is unavailable in this tab. No new stock movement was sent; inspect the ledger and physical source before continuing.";
export function createStockUncertainJournal(
  getStorage:()=>PendingStorage=()=>window.sessionStorage,
){
  return {
    isBlocked():boolean{
      try{
        // Any unexpected value is a potential pending write, not an
        // invitation to erase an unrecognized stock reconciliation record.
        return getStorage().getItem(KEY)!==null;
      }catch{return true;}
    },
    markPending():void{
      try{
        const storage=getStorage();
        if(storage.getItem(KEY)!==null)throw new Error("Existing unresolved stock write.");
        storage.setItem(KEY,"pending");
        if(storage.getItem(KEY)!=="pending")throw new Error("Stock pending marker was not persisted.");
      }catch{throw new Error(FAILURE);}
    },
    clearPending():boolean{
      try{
        const storage=getStorage();
        storage.removeItem(KEY);
        return storage.getItem(KEY)===null;
      }catch{return false;}
    },
  };
}

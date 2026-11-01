// React state updates are not synchronous. Hold an immediate client-side gate
// across a production POST or locked-vault load to prevent rapid double clicks.
// This reduces accidental duplicate submits, but is NOT server idempotency.
export function createOperatorMutationGate(){
  let active=false;
  return {
    enter():boolean{
      if(active)return false;
      active=true;
      return true;
    },
    exit():void{active=false;},
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFabricPhysicalEvidenceProvenance,hasFabricPhysicalEvidenceProvenance} from '../src/lib/fabric-physical-provenance.ts';
import {catalogPhysicalCsvPrefill} from '../src/lib/fabric-analyzer-batch-csv.ts';
const evidence={sourceType:'supplier_document',reference:'Card 42',checkedBy:'Operator A',evidenceDate:'2026-10-27',sourceUrl:'https://supplier.example/card42'};

test('valid written evidence retains normalized text and optional omissions',()=>{
  assert.deepEqual(normalizeFabricPhysicalEvidenceProvenance({...evidence,reference:'  Card\n42  '}),evidence);
  assert.deepEqual(normalizeFabricPhysicalEvidenceProvenance({...evidence,evidenceDate:null,sourceUrl:undefined}),{
    sourceType:'supplier_document',reference:'Card 42',checkedBy:'Operator A',
  });
});

for(const key of ['sourceType','reference','checkedBy','evidenceDate','sourceUrl'] as const){
  test(`physical provenance refuses coercion of ${key}`,()=>{
    for(const malformed of [[evidence[key]],{},42,true,false]){
      const input={...evidence,[key]:malformed};
      assert.equal(normalizeFabricPhysicalEvidenceProvenance(input),null);
      assert.equal(hasFabricPhysicalEvidenceProvenance(input),false);
      assert.deepEqual(catalogPhysicalCsvPrefill({physicalEvidence:input,weightGsm:145,drape:'structured'}),{
        verifiedGsm:'',verifiedDrape:'',verifiedPhysicalSourceUrl:'',verifiedPhysicalEvidenceNote:'',
      });
    }
  });
}

test('untrusted objects never have toString invoked as evidence',()=>{
  let conversions=0;
  const object={toString(){conversions++;throw Error('must not be converted');}};
  assert.equal(normalizeFabricPhysicalEvidenceProvenance({...evidence,reference:object}),null);
  assert.equal(conversions,0);
});

test('catalogue worksheet cannot label invalid or out-of-contract GSM as verified',()=>{
  for(const weightGsm of [-150,0,39.9,1000.1,Infinity,NaN]){
    const result=catalogPhysicalCsvPrefill({physicalEvidence:evidence,weightGsm,drape:'structured'});
    assert.equal(result.verifiedGsm,'');
    assert.equal(result.verifiedDrape,'Structured');
  }
  for(const weightGsm of [40,145,1000]){
    assert.equal(catalogPhysicalCsvPrefill({physicalEvidence:evidence,weightGsm}).verifiedGsm,weightGsm);
  }
});

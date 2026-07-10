# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
TARGET = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\mahima.html"

day3_json = io.open(SP + r"\req3_day3.json", encoding="utf-8").read()

js_addition = f"""const DAY3={day3_json};
let RANGE3=ROWS3;

function daysBetween3(start,end){{
  var out=[];
  var cur=new Date(start+'T00:00:00Z');
  var last=new Date(end+'T00:00:00Z');
  while(cur.getTime()<=last.getTime()){{
    out.push(cur.toISOString().slice(0,10));
    cur.setUTCDate(cur.getUTCDate()+1);
  }}
  return out;
}}

function rangeBase3(start,end){{
  if(!start||!end) return ROWS3;
  var days = start<=end ? daysBetween3(start,end) : daysBetween3(end,start);
  var agg={{}};
  days.forEach(function(day){{
    var entries=DAY3[day]||[];
    entries.forEach(function(e){{
      var idx=e[0];
      if(!agg[idx]) agg[idx]={{imp:0,cl:0,co:0,cost_na:true,cv:0,va:0}};
      agg[idx].imp+=e[1]; agg[idx].cl+=e[2];
      if(e[3]!==null){{ agg[idx].co+=e[3]; agg[idx].cost_na=false; }}
      agg[idx].cv+=e[4]; agg[idx].va+=e[5];
    }});
  }});
  return ROWS3.map(function(r,i){{
    var a=agg[i];
    if(!a) return Object.assign({{}},r,{{imp:0,cl:0,ctr:0,cpc:null,co:r.co==null?null:0,cv:0,cvr:0,va:0,ro:0,cpco:null}});
    var ctr = a.imp>0 ? Math.round((a.cl/a.imp*100)*100)/100 : 0;
    var co = a.cost_na ? null : Math.round(a.co*100)/100;
    var cpc = (a.cl>0 && !a.cost_na) ? Math.round((a.co/a.cl)*100)/100 : null;
    var cvr = a.cl>0 ? Math.round((a.cv/a.cl*100)*100)/100 : 0;
    var va = Math.round(a.va*100)/100;
    var ro = (!a.cost_na && a.co>0) ? Math.round((va/a.co)*100)/100 : 0;
    var cpco = (a.cv>0 && !a.cost_na) ? Math.round((a.co/a.cv)*100)/100 : null;
    return Object.assign({{}},r,{{imp:Math.round(a.imp),cl:Math.round(a.cl),ctr:ctr,cpc:cpc,co:co,cv:Math.round(a.cv*100)/100,cvr:cvr,va:va,ro:ro,cpco:cpco}});
  }});
}}

function updateKpis3(){{
  let terms=RANGE3.length, cost=0, va=0, keep=0, exclude=0;
  for(const r of RANGE3){{
    if(r.co!=null) cost+=r.co;
    va+=r.va;
    if(r.ac.startsWith('Keep')) keep++; else exclude++;
  }}
  document.getElementById('kpiTerms3').textContent=terms.toLocaleString();
  document.getElementById('kpiCost3').textContent='\\u20ac'+cost.toLocaleString(undefined,{{minimumFractionDigits:2,maximumFractionDigits:2}});
  document.getElementById('kpiConvValue3').textContent='\\u20ac'+va.toLocaleString(undefined,{{minimumFractionDigits:2,maximumFractionDigits:2}});
  document.getElementById('kpiRoas3').textContent=(cost>0?(va/cost).toFixed(2):'0')+'x';
  document.getElementById('kpiKeep3').textContent=keep.toLocaleString();
  document.getElementById('kpiExclude3').textContent=exclude.toLocaleString();
}}

function pickRange3(){{
  const start=document.getElementById('rangeStart3').value;
  const end=document.getElementById('rangeEnd3').value;
  RANGE3=rangeBase3(start,end);
  for(const r of RANGE3){{ r._st=(r.st||'').toLowerCase(); r._c=(r.c||'').toLowerCase(); }}
  document.querySelectorAll('#quickFilters3 .qbtn').forEach(function(b){{b.classList.remove('on');}});
  document.querySelector('#quickFilters3 .qbtn[data-action="all"]').classList.add('on');
  F3=RANGE3;
  updateKpis3();
  applyFilter3();
}}
window.pickRange3=pickRange3;

"""

with io.open(TARGET, encoding="utf-8") as f:
    content = f.read()

marker = "const PAGE_SIZE3=100;"
idx = content.index(marker)
assert idx != -1

content = content[:idx] + js_addition + content[idx:]

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.write(content)

print("inserted DAY3 + range functions before PAGE_SIZE3")

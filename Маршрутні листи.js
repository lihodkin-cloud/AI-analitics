/**
 * ГКД — Маршрутні листи 5.1, 18.10.2026
 * Друк: точне копіювання «Шаблон МЛ» у Google Sheets + нативний PDF.
 * Збережені: журнал, 00-000, додаткові МЛ, Д-/Д2- для дублікатів.
 * HTML більше не перетворює макет шаблона на власні таблиці.
 * Без DriveApp: для точного PDF створюється тимчасова Google-таблиця.
 * 5.1: PDF відкривається у Chrome; додаткові МЛ видаються парами (.1 + .2).
 * Потрібно два файли в Apps Script: Code.gs та ML_Dialog.html.
 */
const ML4 = Object.freeze({
  TASKS:'Завдання', TECH:'Тех.карти', TEMPLATE:'Шаблон МЛ',
  JOURNAL:'Журнал МЛ', FIRST_TASK_ROW:4,
  REGULAR_FIRST_ROW:1, DUPLICATE_FIRST_ROW:46,
  PAGE_ROWS:42, PAGE_COLUMNS:8,
  MAX_PRINT_PAGES:90, MAX_EXTRA_PAIRS:15,
  JOURNAL_COLUMNS:21
});
const ML4_HEADERS = [
  'ID документа','Рік номера','Порядковий номер','Номер на папері','Тип',
  'Рік первісного','Номер первісного','Номер дубліката',
  'Дата пресування','Зміна','Прес','Прес-форма','Виріб','Пресувальник',
  'Назва щита','Рядки завдання','Ключ групи',
  'Час створення','Користувач','Спосіб створення','ID первісного'
];
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Маршрутні листи')
    .addItem('Сформувати МЛ на зміну…','ml4OpenShift')
    .addItem('Додаткові МЛ…','ml4OpenExtra')
    .addItem('Створити дублікат МЛ…','ml4OpenDuplicate')
    .addToUi();
}
function ml4OpenShift(){ml4Show_('shift');}
function ml4OpenExtra(){ml4Show_('extra');}
function ml4OpenDuplicate(){ml4Show_('duplicate');}
function ml4Show_(mode) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const tz=ss.getSpreadsheetTimeZone();
  const html=HtmlService.createTemplateFromFile('ML_Dialog');
  html.initialMode=mode;
  html.initialToday=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
  html.initialYear=Number(Utilities.formatDate(new Date(),tz,'yyyy'));
  SpreadsheetApp.getUi().showModalDialog(html.evaluate().setWidth(780).setHeight(510), 'Маршрутні листи — підготовка до друку');
}

/** З'єднуємо два фізичні преси в одну виробничу групу. */
function ml51PairGroups_(documents){
  const groups=new Map();
  documents.forEach(d=>{
    const key=d.groupKey;
    if(!groups.has(key))groups.set(key,{press:d.press,groupKey:key,left:null,right:null});
    const g=groups.get(key);
    if(d.pressLabel==='Прес '+d.press+'.1')g.left=d;
    else if(d.pressLabel==='Прес '+d.press+'.2')g.right=d;
    else throw new Error('Невідомий фізичний прес у групі '+key+'.');
  });
  const result=Array.from(groups.values());
  result.forEach(g=>{
    if(!g.left||!g.right)throw new Error('Для групи '+g.groupKey+' немає повної пари пресів (.1 і .2).');
  });
  return result;
}
/** Список логічних груп без дроблення на .1/.2; нічого не резервує. */
function ml4ListGroups(dateIso,shiftValue) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const shift=Number(shiftValue);ml4ValidateDate_(dateIso,shift);
  const plan=ml4GetPlan_(ss,dateIso,shift);
  const pairs=ml51PairGroups_(plan.documents);
  return {
    groups:pairs.map((g,i)=>({index:i,
      label:'Прес '+g.press+' (.1 + .2) · '+g.left.mold+' · '+g.left.product+' · '+g.left.operator})),
    warnings:plan.warnings.slice(0,15), skippedNoOperator:plan.skippedNoOperator
  };
}

/** Початковий пакет: 1 МЛ для кожної пари прес/оператор/щит. */
function ml4PrepareShift(dateIso,shiftValue) {
  const shift=Number(shiftValue);ml4ValidateDate_(dateIso,shift);
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const plan=ml4GetPlan_(ss,dateIso,shift);
  if(!plan.documents.length)throw new Error('Немає завдань для пресів 1–6 з указаним оператором. Пропущено без оператора: '+plan.skippedNoOperator+'.');
  ml5CheckTemplate_(ss,'regular'); // перевіряємо шаблон ДО видачі номерів
  const lock=ml4Lock_();
  let docs;
  try{
    const journal=ml4Journal_(ss);
    const existing=ml4ReadJournal_(journal);
    // Для початкового комплекту повторне відкриття ТІЄЇ Ж зміни
    // не повинно видавати нових номерів. Це важливо після невдалого друку.
    // На фрезеруванні дублікат, як і раніше, створюється окремою командою.
    const issued=new Map();
    existing.filter(r=>r.mode==='Початковий' && r.productionDate===dateIso && r.shift===shift)
      .forEach(r=>issued.set(r.groupKey+'|'+r.press,r));
    const fresh=plan.documents.filter(d=>!issued.has(d.groupKey+'|'+d.pressLabel));
    if(plan.documents.length>ML4.MAX_PRINT_PAGES)throw new Error('Знайдено '+plan.documents.length+' МЛ. Максимум за один друк — '+ML4.MAX_PRINT_PAGES+'.');
    const added=fresh.length?ml4ReserveRegular_(ss,journal,existing,fresh,dateIso,shift,'Початковий'):[];
    const newByKey=new Map(added.map(d=>[d.groupKey+'|'+d.pressLabel,d]));
    docs=plan.documents.map(d=>{
      const key=d.groupKey+'|'+d.pressLabel;
      if(newByKey.has(key))return newByKey.get(key);
      const r=issued.get(key);
      return Object.assign({},d,{id:r.id,paper:r.paper,type:'Звичайний',year:r.year,
        serial:r.serial,rootYear:r.year,rootPaper:r.paper,ordinal:0,
        dateIso:dateIso,shift:shift,mode:'Початковий',originId:r.id,
        product:r.product,operator:r.operator,mold:r.mold,board:r.board,
        pressLabel:r.press});
    });
  }finally{lock.releaseLock();}
  return ml5ExportAndBundle_(ss,docs,{warnings:plan.warnings,skippedNoOperator:plan.skippedNoOperator});
}

/** Додаткові МЛ видаються парами для двох фізичних пресів однієї групи. */
function ml4PrepareExtra(dateIso,shiftValue,groupIndex,quantity) {
  const shift=Number(shiftValue);ml4ValidateDate_(dateIso,shift);
  const n=Number(quantity),idx=Number(groupIndex);
  if(!Number.isInteger(n)||n<1||n>ML4.MAX_EXTRA_PAIRS){
    throw new Error('Кількість комплектів має бути від 1 до '+ML4.MAX_EXTRA_PAIRS+' (по два МЛ у комплекті).');
  }
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const plan=ml4GetPlan_(ss,dateIso,shift);
  const pairs=ml51PairGroups_(plan.documents);
  if(!Number.isInteger(idx)||idx<0||idx>=pairs.length){
    throw new Error('Вибрану групу не знайдено. Оновіть список груп.');
  }
  const selected=pairs[idx];
  // Кожен комплект = один новий МЛ на .1 і один на .2.
  const array=[];
  for(let i=0;i<n;i++)array.push(selected.left,selected.right);
  ml5CheckTemplate_(ss,'regular');
  const lock=ml4Lock_();
  let docs;
  try{
    const journal=ml4Journal_(ss);
    docs=ml4ReserveRegular_(ss,journal,ml4ReadJournal_(journal),array,dateIso,shift,'Додатковий');
  }finally{lock.releaseLock();}
  return ml5ExportAndBundle_(ss,docs,{warnings:plan.warnings});
}

/** Дублікат без нової порядкової цифри року; ланцюг Д-, Д2-, Д3-… */
function ml4PrepareDuplicate(code,yearValue){
  const match=String(code||'').trim().toUpperCase().replace(/\s/g,'').match(/^(?:Д\d*-)?(\d\d)-(\d\d\d)$/u);
  if(!match)throw new Error('Введіть номер, наприклад 12-345 або Д-12-345.');
  const paper=match[1]+'-'+match[2];
  const yearStr=String(yearValue||'').trim();
  if(yearStr && !/^20\d{2}$/.test(yearStr))throw new Error('Рік первісного МЛ має містити чотири цифри.');
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ml5CheckTemplate_(ss,'duplicate');
  const lock=ml4Lock_();
  let doc;
  try{
    const journal=ml4Journal_(ss);
    const history=ml4ReadJournal_(journal);
    const masters=history.filter(r=>r.type==='Звичайний' && r.paper===paper && (!yearStr||r.year===Number(yearStr)));
    if(!masters.length)throw new Error('Первісний МЛ '+paper+' не знайдено в журналі.'+(yearStr?' Перевірте рік.':''));
    if(masters.length>1)throw new Error('Номер '+paper+' зустрічається у кількох роках. Вкажіть рік первісного МЛ.');
    const root=masters[0];
    const ordinal=history.filter(r=>r.type==='Дублікат'&&r.rootYear===root.year&&r.rootPaper===paper)
      .reduce((max,r)=>Math.max(max,r.ordinal),0)+1;
    const duplicateNumber=(ordinal===1?'Д':'Д'+ordinal)+'-'+paper;
    const id=root.year+'-'+duplicateNumber;
    if(history.some(r=>r.id===id))throw new Error('Номер дубліката вже існує. Повторіть спробу.');
    doc={
      id:id,year:root.year,serial:root.serial,paper:duplicateNumber,
      type:'Дублікат',rootYear:root.year,rootPaper:paper,ordinal:ordinal,
      dateIso:root.productionDate,shift:root.shift,pressLabel:root.press,mold:root.mold,
      product:root.product,operator:root.operator,board:root.board,
      sourceRows:root.sourceRows,groupKey:root.groupKey,mode:'Дублікат',originId:root.id
    };
    ml4Append_(ss,journal,[doc]);
  }finally{lock.releaseLock();}
  return ml5ExportAndBundle_(ss,[doc],{warnings:[]});
}

/** Не викликати з клієнта напряму: потрібне блокування для видачі номерів. */
function ml4ReserveRegular_(ss,journal,history,inputs,dateIso,shift,mode){
  const year=Number(Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyy'));
  let serial=history.filter(r=>r.type==='Звичайний'&&r.year===year)
    .reduce((max,r)=>Math.max(max,r.serial),0);
  const result=inputs.map(d=>{
    serial++;
    if(serial>99999)throw new Error('Вичерпано номери року '+year+' (99-999).');
    const paper=ml4Number_(serial),id=year+'-'+paper;
    return Object.assign({},d,{
      id:id,year:year,serial:serial,paper:paper,type:'Звичайний',
      rootYear:year,rootPaper:paper,ordinal:0,
      dateIso:dateIso,shift:shift,mode:mode,originId:id
    });
  });
  ml4Append_(ss,journal,result);
  return result;
}
function ml4Number_(number) {
  if(!Number.isInteger(number)||number<1||number>99999)throw new Error('Неправильний номер МЛ.');
  const n=String(number).padStart(5,'0');
  return n.slice(0,2)+'-'+n.slice(2);
}
function ml4Lock_(){
  const lock=LockService.getDocumentLock()||LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Інший майстер зараз видає номери. Повторіть через кілька секунд.');
  return lock;
}
function ml4Journal_(ss){
  let s=ss.getSheetByName(ML4.JOURNAL);
  if(!s){
    s=ss.insertSheet(ML4.JOURNAL);
    s.getRange(1,1,1,ML4.JOURNAL_COLUMNS).setValues([ML4_HEADERS]);
    s.setFrozenRows(1);
    s.getRange(1,1,1,ML4.JOURNAL_COLUMNS).setFontWeight('bold').setBackground('#dcece4');
    s.getRange('D:D').setNumberFormat('@');
    s.getRange('G:G').setNumberFormat('@');
  }else{
    if(s.getMaxColumns()<ML4.JOURNAL_COLUMNS)throw new Error('У «Журнал МЛ» бракує колонок. Потрібно '+ML4.JOURNAL_COLUMNS+'.');
    const titles=s.getRange(1,1,1,ML4.JOURNAL_COLUMNS).getDisplayValues()[0];
    if(titles.join('|')!==ML4_HEADERS.join('|'))throw new Error('Заголовки «Журнал МЛ» відрізняються від очікуваних. Не змінюйте структуру журналу.');
  }
  return s;
}
function ml4ReadJournal_(sheet) {
  const last=sheet.getLastRow();if(last<2)return [];
  return sheet.getRange(2,1,last-1,ML4.JOURNAL_COLUMNS).getValues().filter(r=>r[0]).map(r=>({
    id:String(r[0]),year:Number(r[1]),serial:Number(r[2]),paper:String(r[3]),
    type:String(r[4]),rootYear:Number(r[5]),rootPaper:String(r[6]),ordinal:Number(r[7])||0,
    productionDate:r[8] instanceof Date? Utilities.formatDate(r[8],sheet.getParent().getSpreadsheetTimeZone(),'yyyy-MM-dd'):String(r[8]),
    shift:Number(r[9]),press:String(r[10]),mold:String(r[11]),product:String(r[12]),
    operator:String(r[13]),board:String(r[14]),sourceRows:String(r[15]),groupKey:String(r[16]),
    mode:String(r[19])
  }));
}
function ml4Append_(ss,sheet,docs){
  if(!docs.length)return;
  const now=new Date();
  const user=Session.getActiveUser().getEmail()||'(не визначено)';
  const rows=docs.map(d=>[
    d.id,d.year,d.serial,d.paper,d.type,d.rootYear,d.rootPaper,d.ordinal,
    d.dateIso,d.shift,d.pressLabel,d.mold,d.product,d.operator,d.board||'',
    Array.isArray(d.sourceRows)?d.sourceRows.join(', '):String(d.sourceRows||''),d.groupKey||'',
    now,user,d.mode,d.originId
  ]);
  const start=sheet.getLastRow()+1;
  const needed=start+rows.length-1;
  if(sheet.getMaxRows()<needed){
    sheet.insertRowsAfter(sheet.getMaxRows(),Math.max(500,needed-sheet.getMaxRows()));
  }
  sheet.getRange(start,4,rows.length,1).setNumberFormat('@');
  sheet.getRange(start,7,rows.length,1).setNumberFormat('@');
  sheet.getRange(start,1,rows.length,ML4.JOURNAL_COLUMNS).setValues(rows);
  SpreadsheetApp.flush();
}
/**
 * V5.0 — ПОВЕРНЕННЯ ДО РІДНОГО МАКЕТА GOOGLE SHEETS.
 * HTML не відтворює клітинки: воно показує тільки форму та посилання на PDF.
 * Жодних записів на «AI Маршрутні листи»; оригінальний «Шаблон МЛ» не змінюється.
 */
function ml5CheckTemplate_(ss,kind){
  const sheet=ml4MustSheet_(ss,ML4.TEMPLATE);
  const end=kind==='duplicate'?87:42;
  if(sheet.getMaxRows()<end||sheet.getMaxColumns()<8){
    throw new Error('У «Шаблон МЛ» недостатньо рядків або колонок. Потрібні A1:H87.');
  }
  const start=kind==='duplicate'?46:1;
  const title=sheet.getRange(start,1).getDisplayValue().toUpperCase();
  if(kind==='duplicate'?!title.includes('ДУБЛІКАТ'):!title.includes('МАРШРУТНИЙ')){
    throw new Error('Не знайдено заголовок '+kind+' у рядку '+start+' шаблона.');
  }
  const tag=sheet.getRange(start+22,1).getDisplayValue().toUpperCase();
  if(kind==='duplicate'?!tag.includes('ДУБЛІКАТ'):!tag.includes('БИРКА')){
    throw new Error('Не знайдено відривну бирку в рядку '+(start+22)+' шаблона.');
  }
}
function ml5ExportAndBundle_(ss,documents,extras){
  if(!documents.length)throw new Error('Немає МЛ для друку.');
  const result=ml5GenerateNativePdf_(ss,documents);
  return {
    count:documents.length,
    url:result.url,
    temporary:result.temporary,
    note:result.note||'',
    numbers:documents.map(d=>d.paper),
    warnings:extras.warnings||[],
    skippedNoOperator:extras.skippedNoOperator||0
  };
}
function ml5PrintFill_(page,doc){
  const parts=String(doc.dateIso).split('-');
  const date=parts[2]+'.'+parts[1]+'.'+parts[0];
  const mappings=[
    [['D1','D23'],doc.paper],
    [['H1','H23','A5','A27'],doc.product],
    [['A2','A24'],date],
    [['C2','C24'],doc.shift+' зміна'],
    [['E2','E24'],doc.pressLabel],
    [['G2','G24'],doc.mold],
    [['A3','A25'],doc.operator]
  ];
  // Явно вказуємо текстовий формат, щоб 00-001 не перетворився на дату.
  page.getRangeList(['D1','D23']).setNumberFormat('@');
  page.getRangeList(['A2','A24']).setNumberFormat('@');
  mappings.forEach(m=>page.getRangeList(m[0]).setValue(m[1]));
  // H2/H24 — фізичний екземпляр прес-форми: майстер дописує від руки.
  // H3/H25 у дублікаті — залишок щитів: майстер вписує сам.
}
function ml5PdfQuery_(){
  return [
    'format=pdf','size=7','portrait=true','scale=4','fitw=true',
    'gridlines=false','sheetnames=false','printtitle=false',
    'pagenum=UNDEFINED','fzr=false','fzc=false',
    'top_margin=0.25','bottom_margin=0.25',
    'left_margin=0.25','right_margin=0.25',
    'attachment=false'
  ].join('&');
}
function ml5GenerateNativePdf_(source,documents){
  // Рідний формат Google Sheets: точна копія «Шаблон МЛ», не HTML-реконструкція.
  // Для майстрів немає DriveApp: не потрібен доступ до папки з «ГКД 2026».
  const template=ml4MustSheet_(source,ML4.TEMPLATE);
  const stamp=Utilities.formatDate(new Date(),source.getSpreadsheetTimeZone(),'yyyyMMdd_HHmmss');
  const mode=documents[0].type==='Дублікат'?'Дублікат':'МЛ';
  // Файл належить користувачеві, що натиснув «Підготувати PDF».
  const temp=SpreadsheetApp.create('TEMP_МЛ_друк_'+mode+'_'+stamp);
  const blank=temp.getSheets()[0];
  const base=template.copyTo(temp); // повне копіювання комірок, стилів і об'єднань
  base.setName('__ШАБЛОН_ДЛЯ_ДРУКУ__');
  const isDup=documents[0].type==='Дублікат';
  const top=isDup?46:1;
  const end=top+ML4.PAGE_ROWS-1;
  // Для дубліката залишаємо лише A46:H87; для звичайного A1:H42.
  if(base.getMaxRows()>end)base.deleteRows(end+1,base.getMaxRows()-end);
  if(top>1)base.deleteRows(1,top-1);
  if(base.getMaxColumns()>ML4.PAGE_COLUMNS){
    base.deleteColumns(ML4.PAGE_COLUMNS+1,base.getMaxColumns()-ML4.PAGE_COLUMNS);
  }
  if(base.getMaxRows()!==42)throw new Error('Шаблон сторінки повинен містити 42 рядки.');
  for(let i=0;i<documents.length;i++){
    const page=base.copyTo(temp);
    page.setName('Аркуш '+String(i+1).padStart(3,'0'));
    ml5PrintFill_(page,documents[i]);
  }
  temp.deleteSheet(base);
  temp.deleteSheet(blank);
  SpreadsheetApp.flush();
  const pdfUrl='https://docs.google.com/spreadsheets/d/'+temp.getId()+'/export?'+ml5PdfQuery_();
  return {url:pdfUrl,temporary:true,
    note:'PDF відкривається у вкладці Chrome для перегляду й друку. Якщо Chrome завантажить файл замість перегляду, змініть налаштування відкриття PDF у браузері. Тимчасова Google-таблиця TEMP_МЛ_друк_… залишається у «Моєму диску» користувача; її можна згодом видалити. «Шаблон МЛ» і виробничі завдання не змінюються.'};
}
function ml4MustSheet_(ss,name){
  const sheet=ss.getSheetByName(name);
  if(!sheet)throw new Error('Не знайдено аркуш «'+name+'».');
  return sheet;
}
function ml4ValidateDate_(dateIso,shift){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso)) || ![1,2].includes(shift)) throw new Error('Вкажіть дату і зміну 1 або 2.');
  const [year,month,day]=dateIso.split('-').map(Number);
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw new Error('Некоректна дата.');
}
function ml4Norm_(val){return String(val==null?'':val).replace(/\s+/g,' ').trim();}
function ml4Key_(val){return ml4Norm_(val).toLocaleUpperCase('uk-UA');}
function ml4DateKey_(value,tz){
  if(Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime()))return Utilities.formatDate(value,tz,'yyyy-MM-dd');
  const text=ml4Norm_(value);
  let m=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m=text.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?\.?$/);
  if(!m)return '';
  const day=m[1].padStart(2,'0'),month=m[2].padStart(2,'0');
  if(!m[3])return '--'+month+'-'+day;
  const year=m[3].length===2?'20'+m[3]:m[3];
  return year+'-'+month+'-'+day;
}
function ml4TechMap_(sheet){
  const last=sheet.getLastRow(),map=new Map();
  if(last<3)return map;
  const values=sheet.getRange(3,1,last-2,4).getValues();
  values.forEach(r=>{
    const product=ml4Norm_(r[0]),board=ml4Norm_(r[3]);
    if(!product)return;
    const k=ml4Key_(product);
    if(!map.has(k)){map.set(k,{board:board,conflict:false});return;}
    const v=map.get(k);
    if(board&&v.board&&ml4Key_(board)!==ml4Key_(v.board))v.conflict=true;
    else if(board&&!v.board)v.board=board;
  });
  return map;
}
function ml4Tasks_(sheet,tz,dateIso,shift){
  const last=sheet.getLastRow(),start=ML4.FIRST_TASK_ROW;
  if(last<start)return [];
  const n=last-start+1;
  const main=sheet.getRange(start,2,n,6).getValues(); // B:G: дата, зміна, прес, замовлення
  const products=sheet.getRange(start,9,n,1).getValues(); // I
  const operators=sheet.getRange(start,20,n,1).getValues(); // T
  const rows=[],dateCache=new Map();
  const dayMonth='--'+dateIso.slice(5);
  for(let i=0;i<n;i++){
    const r=main[i];
    if(Number(r[1])!==shift)continue;
    const machine=ml4Norm_(r[4]);
    if(!/^Прес\s+[1-6]$/iu.test(machine))continue;
    const key=r[0] instanceof Date?r[0].getTime():String(r[0]);
    if(!dateCache.has(key))dateCache.set(key,ml4DateKey_(r[0],tz));
    const date=dateCache.get(key);
    if(date!==dateIso&&date!==dayMonth)continue;
    rows.push({row:start+i,date:date,shift:shift,machine:machine,
      order:ml4Norm_(r[5]),product:ml4Norm_(products[i][0]),operator:ml4Norm_(operators[i][0])});
  }
  return rows;
}
function ml4GetPlan_(ss,dateIso,shift){
  const tech=ml4TechMap_(ml4MustSheet_(ss,ML4.TECH));
  const rows=ml4Tasks_(ml4MustSheet_(ss,ML4.TASKS),ss.getSpreadsheetTimeZone(),dateIso,shift);
  return ml4BuildPlan_(rows,tech,dateIso,shift);
}
function ml4BuildPlan_(rows,tech,dateIso,shift){
  const map=new Map(),errors=[],warnings=[];
  let skippedNoOperator=0;
  const dayMonth='--'+dateIso.slice(5);
  rows.forEach(r=>{
    if(r.shift!==shift||(r.date!==dateIso&&r.date!==dayMonth))return;
    const pressMatch=/^Прес\s+([1-6])$/iu.exec(r.machine);
    if(!pressMatch)return;
    if(!r.order&&r.product.indexOf('_')<0)return;
    if(!r.product)return;
    if(!r.operator){skippedNoOperator++;return;}
    const mold=r.product.split('_')[0].trim();
    if(r.product.indexOf('_')<1||!mold){errors.push('Рядок '+r.row+': немає назви прес-форми у назві виробу.');return;}
    const ent=tech.get(ml4Key_(r.product));
    if(ent?.conflict){errors.push('Рядок '+r.row+': суперечливі назви щитів у техкарті.');return;}
    const board=ent?ent.board:'';
    if(!board)warnings.push('Рядок '+r.row+': для '+r.product+' немає назви щита в техкарті.');
    const press=Number(pressMatch[1]);
    const boardKey=board?ml4Key_(board):'НЕВІДОМИЙ:'+ml4Key_(r.product);
    const key=[dateIso,shift,press,ml4Key_(r.operator),ml4Key_(mold),boardKey].join('|');
    if(!map.has(key))map.set(key,{press:press,operator:r.operator,mold:mold,
      board:board,product:r.product,sourceRows:[],groupKey:key});
    map.get(key).sourceRows.push(r.row);
  });
  if(errors.length)throw new Error('Проблеми у виробничому завданні:\n'+errors.slice(0,15).join('\n'));
  const documents=[];
  map.forEach(g=>{
    documents.push(Object.assign({},g,{pressLabel:'Прес '+g.press+'.1'}));
    documents.push(Object.assign({},g,{pressLabel:'Прес '+g.press+'.2'}));
  });
  return {documents,warnings,skippedNoOperator};
}

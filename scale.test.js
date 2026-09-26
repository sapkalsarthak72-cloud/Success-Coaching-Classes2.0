const { loadPortal } = require('./mock-gas'); const path=require('path'); const vm=require('vm');
const ctx=loadPortal(path.join(__dirname,'..','src','backend')); const run=c=>vm.runInContext(c,ctx);
const log=console.log; console.log=()=>{}; run('setupPortal()'); console.log=log;
run('Db.update("Users", Db.first("Users",u=>u.Role==="ADMIN"), {AuthData: Auth.make("Admin@12345")})');
ctx.__N=2000;
run(`(function(){
 var now=U.now(), users=[],students=[],teachers=[],batches=[],fees=[],pays=[],att=[],res=[];
 for(var t=1;t<=25;t++){ teachers.push({TeacherID:'TCH'+U.pad(t,3),UserID:'X',Name:'T'+t,Subject:'S',Phone:'9000000000',Status:'ACTIVE',CreatedAt:now,UpdatedAt:now}); }
 var cls=['8','9','10'];
 for(var b=0;b<75;b++){ var c=cls[b%3]; batches.push({Batch:c+'-B'+b,Class:c,Subject:'Sub'+(b%5),Teacher:'TCH'+U.pad(1+b%25,3),Schedule:'Mon/Wed/Fri 5 PM',Status:'ACTIVE'}); }
 for(var i=1;i<=__N;i++){ var c2=cls[i%3]; var bl=batches.filter(function(x){return x.Class===c2;}); var mine=[bl[i%bl.length].Batch,bl[(i+1)%bl.length].Batch,bl[(i+2)%bl.length].Batch];
  var id='STU'+U.pad(i,4); students.push({StudentID:id,UserID:'USR'+U.pad(i,5),Name:'Student '+i,Class:c2,Batch:mine.join(', '),Phone:'9000000000',Status:'ACTIVE',CreatedAt:now,UpdatedAt:now});
  users.push({UserID:'USR'+U.pad(i,5),Username:id,AuthData:'v1$1$x$y',Role:'STUDENT',Status:'ACTIVE',NotifSeenAt:now,CreatedAt:now,UpdatedAt:now});
  fees.push({StudentID:id,FeeType:'Course Fee',TotalFee:30000,Discount:0,FinalFee:30000,Paid:10000,Remaining:20000,Status:'PARTIAL',DueDate:'2026-12-01',UpdatedAt:now});
  for(var k=0;k<2;k++) pays.push({PaymentID:'PAY'+U.pad(i*2+k,6),StudentID:id,FeeType:'Course Fee',Amount:5000,Date:'2026-09-0'+(k+1),PaymentMode:'CASH',ReceiptNumber:'SCC-2627-'+U.pad(i*2+k,6),PreviousBalance:1,RemainingBalance:1,Notes:'',ReceiptFileID:'',CreatedBy:'ADMIN',CreatedAt:now});
 }
 var today=U.today();
 for(var d=1;d<=300;d++){ var date=U.addDays(today,-d); batches.forEach(function(b){ if(U.weekday(date)===0)return; var ids=students.filter(function(s){return false;}); att.push({Date:date,Batch:b.Batch,Present:28,Absent:2,PresentIDs:'STU0001, STU0002, STU0003, STU0004, STU0005, STU0006, STU0007, STU0008, STU0009, STU0010, STU0011, STU0012, STU0013, STU0014, STU0015, STU0016, STU0017, STU0018, STU0019, STU0020',AbsentIDs:'STU0100, STU0101',Remarks:'',MarkedBy:b.Teacher,UpdatedAt:date+' 18:00:00'}); }); }
 Db.insert('Users',users);Db.insert('Teachers',teachers);Db.insert('Batches',batches);Db.insert('Students',students);Db.insert('Fees',fees);Db.insert('Payments',pays);Db.insert('Attendance',att);
 globalThis.__att=att.length;
})()`);
console.log('rows: students',run('Db.count("Students")'),'payments',run('Db.count("Payments")'),'attendance',run('Db.count("Attendance")'));
const call=(a,t,p)=>ctx.api(a,t,p||{}); 
const t0=Date.now(); const A=call('auth.login',null,{username:'admin',password:'Admin@12345'}).data.token; console.log('admin login ms',Date.now()-t0);
function time(label,fn){ const s=process.hrtime.bigint(); const r=fn(); console.log(label.padEnd(34),Number(process.hrtime.bigint()-s)/1e6|0,'ms', r&&r.ok===false?'ERR '+r.error:''); return r; }
time('students.list (page 1)',()=>call('students.list',A,{}));
time('students.list search',()=>call('students.list',A,{q:'Student 19'}));
time('fees.outstanding',()=>call('fees.outstanding',A,{}));
time('payments.list',()=>call('payments.list',A,{}));
time('dashboard.admin (fresh)',()=>call('dashboard.get',A,{fresh:true}));
time('attendance.overview',()=>call('attendance.overview',A,{}));
time('batches.list',()=>call('batches.list',A,{}));
const S=(()=>{ run('Db.update("Users", Db.get("Users","Username","STU0001"), {AuthData: Auth.make("Pass1234")})'); return call('auth.login',null,{username:'STU0001',password:'Pass1234'}).data.token; })();
time('student dashboard',()=>call('dashboard.get',S,{}));
time('attendance.my',()=>call('attendance.my',S,{}));
const b0=run('Db.get("Students","StudentID","STU0001").Batch.split(",")[0]');
time('attendance.save (admin, 30 stud)',()=>call('attendance.save',A,{batch:b0,date:run('U.today()'),records:[]}));
time('payments.record',()=>call('payments.record',A,{studentId:'STU0005',feeType:'Course Fee',amount:1000,paymentMode:'CASH'}));

/* ============================================================
   BearMinds — App (router + UI)
   Vanilla JS, sem build, offline-friendly.
   Rota por hash: #/<ano>/<turma>/<disciplina>/<trimestre>/<atividade>
   ============================================================ */
(function(){
  "use strict";

  var C = window.BM_CURRICULUM;
  var CONTENT = window.BM_CONTENT || {};
  var app = document.getElementById("app");

  /* ---------- helpers ---------- */
  function el(html){ var d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstChild; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function contentKey(a){ return a.filter(Boolean).join("."); }
  // um nó está liberado se existir alguma chave de conteúdo com aquele prefixo
  function hasContent(prefix){
    for(var k in CONTENT){ if(k===prefix || k.indexOf(prefix+".")===0) return true; }
    return false;
  }
  function find(list,id){ for(var i=0;i<list.length;i++){ if(list[i].id===id) return list[i]; } return null; }

  /* ---------- router ---------- */
  function parse(){
    var h=(location.hash||"").replace(/^#\/?/,"");
    return h.split("/").filter(function(s){return s!=="";});
  }
  function go(path){ location.hash = "#/" + path.filter(Boolean).join("/"); }
  function back(){ history.length>1 ? history.back() : go([]); }

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", render);

  /* ---------- chrome (topbar + crumbs) ---------- */
  function shell(opts){
    // opts: {crumbs:[{label,path}], showBack, body, tag}
    var top =
      '<div class="topbar">' +
        (opts.showBack ? '<button class="back" aria-label="Voltar" data-back>‹</button>' : '<span class="brand"><span class="leaf">🐻</span>BearMinds</span>') +
        (opts.showBack ? '<span class="brand"><span class="leaf">🐻</span>BearMinds</span>' : '') +
        '<span class="spacer"></span>' +
        (opts.tag ? '<span class="tag-mini">'+esc(opts.tag)+'</span>' : '') +
      '</div>';
    var crumbs = "";
    if(opts.crumbs && opts.crumbs.length){
      var parts = opts.crumbs.map(function(c,i){
        var last = i===opts.crumbs.length-1;
        return (last? '<b>'+esc(c.label)+'</b>' : '<span data-nav="'+c.path+'">'+esc(c.label)+'</span>');
      });
      crumbs = '<div class="crumbs">'+parts.join(' <span class="sep">›</span> ')+'</div>';
    }
    app.innerHTML = top + crumbs + '<main id="main">'+opts.body+'</main>' +
      '<div class="foot"><span class="leaf">🍁</span> BearMinds · Maple Bear Canadian School</div>';

    var b=app.querySelector("[data-back]"); if(b) b.addEventListener("click",back);
    app.querySelectorAll("[data-nav]").forEach(function(n){
      n.style.cursor="pointer";
      n.addEventListener("click",function(){ location.hash="#/"+n.getAttribute("data-nav"); });
    });
    window.scrollTo(0,0);
  }

  /* ============================================================
     SCREENS
     ============================================================ */

  function screenHome(){
    var body =
      '<div class="hero">' +
        '<div class="mascot">🐻</div>' +
        '<h1>BearMinds<span class="dot">.</span></h1>' +
        '<p class="pitch">Seus estudos Maple Bear, na palma da mão. Escolha e comece! 🍁</p>' +
        '<div class="leafline">🍁 🌍 📚 🔬 🎨</div>' +
        '<button class="cta" data-start>Começar a estudar ›</button>' +
      '</div>' +
      '<div class="note blue">📱 Funciona no celular, tablet e computador. Selecione <b>Ano</b> › <b>Turma</b> › <b>Disciplina</b> › <b>Trimestre</b>.</div>';
    shell({ body:body });
    app.querySelector("[data-start]").addEventListener("click",function(){ go(["2026"]); });
    // se só houver 1 ano, o botão entra direto nas turmas
  }

  function screenClasses(yearId){
    var year=find(C.years,yearId); if(!year){ go([]); return; }
    var cards = C.classes.map(function(cl){
      var on=hasContent(contentKey([yearId,cl.id]));
      if(on){
        return '<button class="tile" data-go="'+yearId+'/'+cl.id+'">' +
                 '<span class="ic">🎒</span><span class="t">'+esc(cl.label)+'</span><span class="s">'+esc(cl.age)+'</span>' +
               '</button>';
      }
      return '<div class="tile soon"><span class="ic">🎒</span><span class="t">'+esc(cl.label)+'</span><span class="soon-tag">em breve</span></div>';
    }).join("");
    var body =
      '<h1 class="screen-title">Turma Maple</h1>' +
      '<p class="screen-sub">Ano letivo <b>'+esc(year.label)+'</b> · escolha a sua turma (Y1–Y9).</p>' +
      '<div class="grid classes cols-3">'+cards+'</div>';
    shell({ showBack:true, tag:year.label, crumbs:[{label:year.label,path:yearId}], body:body });
    bindGo();
  }

  function screenSubjects(yearId,classId){
    var year=find(C.years,yearId), cl=find(C.classes,classId);
    if(!year||!cl){ go([yearId]); return; }
    var cards = C.subjects.map(function(su){
      var on=hasContent(contentKey([yearId,classId,su.id]));
      var badge='<span class="badge '+su.lang+'">'+(su.lang==="en"?"EN":"PT")+'</span>';
      if(on){
        return '<button class="card" data-go="'+yearId+'/'+classId+'/'+su.id+'">' +
                 '<span class="ic">'+su.icon+'</span>' +
                 '<span class="tx"><span class="t">'+esc(su.label)+'</span><span class="s">Conteúdo disponível</span></span>' +
                 badge+'<span class="chev">›</span>' +
               '</button>';
      }
      return '<div class="card soon">' +
               '<span class="ic">'+su.icon+'</span>' +
               '<span class="tx"><span class="t">'+esc(su.label)+'</span></span>' +
               '<span class="soon-tag">em breve</span>' +
             '</div>';
    }).join("");
    var body =
      '<h1 class="screen-title">Disciplinas</h1>' +
      '<p class="screen-sub">Turma <b>'+esc(cl.label)+'</b> · '+esc(cl.age)+'.</p>' +
      '<div class="grid">'+cards+'</div>';
    shell({ showBack:true, tag:cl.label, crumbs:[{label:year.label,path:yearId},{label:cl.label,path:yearId+'/'+classId}], body:body });
    bindGo();
  }

  function screenTrimesters(yearId,classId,subId){
    var year=find(C.years,yearId), cl=find(C.classes,classId), su=find(C.subjects,subId);
    if(!year||!cl||!su){ go([yearId,classId]); return; }
    var cards = C.trimesters.map(function(tr){
      var key=contentKey([yearId,classId,subId,tr.id]);
      var on=hasContent(key);
      if(on){
        var c=CONTENT[key];
        var sub=c&&c.subtitle?c.subtitle:"Conteúdo disponível";
        return '<button class="card" data-go="'+yearId+'/'+classId+'/'+subId+'/'+tr.id+'">' +
                 '<span class="ic">🗓️</span>' +
                 '<span class="tx"><span class="t">'+esc(tr.label)+'</span><span class="s">'+esc(sub)+'</span></span>' +
                 '<span class="chev">›</span>' +
               '</button>';
      }
      return '<div class="card soon"><span class="ic">🗓️</span><span class="tx"><span class="t">'+esc(tr.label)+'</span></span><span class="soon-tag">em breve</span></div>';
    }).join("");
    var body =
      '<h1 class="screen-title">'+su.icon+' '+esc(su.label)+'</h1>' +
      '<p class="screen-sub">Turma <b>'+esc(cl.label)+'</b> · escolha o trimestre.</p>' +
      '<div class="grid tri">'+cards+'</div>';
    shell({ showBack:true, tag:cl.label+' · '+su.label,
      crumbs:[{label:year.label,path:yearId},{label:cl.label,path:yearId+'/'+classId},{label:su.label,path:yearId+'/'+classId+'/'+subId}],
      body:body });
    bindGo();
  }

  function screenActivities(yearId,classId,subId,triId){
    var key=contentKey([yearId,classId,subId,triId]);
    var data=CONTENT[key];
    var su=find(C.subjects,subId), cl=find(C.classes,classId), tr=find(C.trimesters,triId), year=find(C.years,yearId);
    if(!data||!su||!tr){ go([yearId,classId,subId]); return; }
    var acts = data.activities.map(function(a){
      var sub = a.subtitle;
      if(a.type==="quiz" && a.questions){ sub = a.questions.length+" perguntas · correção na hora"; }
      else if(a.type==="guide" && a.themes){ sub = a.themes.length+" temas explicados + perguntas para conferir"; }
      return '<button class="act '+(a.type==="quiz"?"quiz":"guide")+'" data-go="'+yearId+'/'+classId+'/'+subId+'/'+triId+'/'+a.id+'">' +
               '<span class="ic">'+a.icon+'</span>' +
               '<span class="tx"><span class="t">'+esc(a.title)+'</span><span class="s">'+esc(sub)+'</span></span>' +
               '<span class="go">›</span>' +
             '</button>';
    }).join("");
    var body =
      '<h1 class="screen-title">'+esc(data.title)+'</h1>' +
      '<p class="screen-sub">'+esc(data.subtitle)+'</p>' +
      (data.intro?'<div class="note">'+esc(data.intro)+'</div>':'') +
      acts;
    shell({ showBack:true, tag:cl.label+' · '+su.label,
      crumbs:[{label:year.label,path:yearId},{label:cl.label,path:yearId+'/'+classId},{label:su.label,path:yearId+'/'+classId+'/'+subId},{label:tr.label,path:yearId+'/'+classId+'/'+subId+'/'+triId}],
      body:body });
    bindGo();
  }

  /* ---------- GUIDE reader ---------- */
  function screenGuide(yearId,classId,subId,triId,act){
    var su=find(C.subjects,subId), cl=find(C.classes,classId);
    var themes=act.themes.map(function(t,i){
      var pts=t.points.map(function(p){ return '<li>'+p+'</li>'; }).join("");
      var val = t.validation ?
        '<div class="reveal" data-reveal>' +
          '<div class="q">✅ Confira: '+esc(t.validation.q)+'</div>' +
          '<button class="reveal-btn" type="button">Ver resposta</button>' +
          '<div class="a">💡 '+t.validation.a+'</div>' +
        '</div>' : "";
      return '<section class="guide-theme">' +
               '<h2><span class="ic">'+t.icon+'</span><span>'+esc(t.title.replace(/^\d+\.\s*/,''))+'</span></h2>' +
               '<div class="concept">'+t.concept+'</div>' +
               '<ul class="points">'+pts+'</ul>' +
               (t.trick?'<div class="trick">'+t.trick+'</div>':'') +
               val +
             '</section>';
    }).join("");
    var base=yearId+'/'+classId+'/'+subId+'/'+triId;
    var body =
      '<h1 class="screen-title">📖 '+esc(act.title)+'</h1>' +
      '<p class="screen-sub">'+esc(act.subtitle)+'</p>' +
      themes +
      '<button class="btn" data-go="'+base+'/quiz" style="margin-top:1rem">🏆 Ir para o Quiz ›</button>' +
      '<button class="btn secondary" data-go="'+base+'" style="margin-top:.7rem">Voltar às atividades</button>';
    shell({ showBack:true, tag:cl.label+' · '+su.label,
      crumbs:[{label:cl.label,path:yearId+'/'+classId},{label:su.label,path:yearId+'/'+classId+'/'+subId},{label:act.title,path:base+'/guia'}],
      body:body });
    // reveal toggles
    app.querySelectorAll("[data-reveal] .reveal-btn").forEach(function(btn){
      btn.addEventListener("click",function(){ btn.parentNode.classList.add("open"); });
    });
    bindGo();
  }

  /* ---------- QUIZ engine ---------- */
  function screenQuiz(yearId,classId,subId,triId,act){
    var su=find(C.subjects,subId), cl=find(C.classes,classId);
    var base=yearId+'/'+classId+'/'+subId+'/'+triId;
    var Q=act.questions, idx=0, score=0;
    var pass = act.passMark || 0.7;

    var body =
      '<div class="bar-out"><div class="bar-in" id="bar"></div></div>' +
      '<div class="bar-txt" id="barTxt"></div>' +
      '<div id="quizArea"></div>';
    shell({ showBack:true, tag:cl.label+' · '+su.label,
      crumbs:[{label:cl.label,path:yearId+'/'+classId},{label:su.label,path:yearId+'/'+classId+'/'+subId},{label:act.title,path:base+'/quiz'}],
      body:body });

    var area=document.getElementById("quizArea");
    var bar=document.getElementById("bar");
    var barTxt=document.getElementById("barTxt");

    function render(){
      var q=Q[idx];
      bar.style.width=(idx/Q.length*100)+"%";
      barTxt.textContent="Pergunta "+(idx+1)+" de "+Q.length;
      var html='<div class="q-card"><span class="q-tag">'+esc(q.tag)+'</span><h3>'+esc(q.q)+'</h3>';
      if(q.type==="mc"){
        q.opts.forEach(function(o,i){ html+='<button class="opt" data-mc="'+i+'">'+esc(o)+'</button>'; });
      } else if(q.type==="vf"){
        html+='<button class="opt" data-vf="1">✔️ Verdadeiro</button><button class="opt" data-vf="0">❌ Falso</button>';
      } else if(q.type==="gap"){
        html+='<input class="gap-in" id="gapInput" inputmode="text" autocapitalize="none" autocomplete="off" autocorrect="off" placeholder="escreva aqui">';
        html+='<button class="btn" data-gap>Conferir</button>';
      } else if(q.type==="match"){
        q.rows.forEach(function(r,ri){
          html+='<div class="match-row"><span class="lab">'+esc(r.left)+'</span><select id="m'+ri+'"><option value="">escolha…</option>';
          r.options.forEach(function(op){ html+='<option value="'+esc(op)+'">'+esc(op)+'</option>'; });
          html+='</select></div>';
        });
        html+='<button class="btn" data-match>Conferir</button>';
      }
      html+='<div class="fb" id="fb"></div>';
      html+='<button class="btn next" id="nextBtn">Próxima ›</button></div>';
      area.innerHTML=html;
      window.scrollTo(0,0);

      area.querySelectorAll("[data-mc]").forEach(function(b){ b.addEventListener("click",function(){ answerMC(+b.getAttribute("data-mc")); }); });
      area.querySelectorAll("[data-vf]").forEach(function(b){ b.addEventListener("click",function(){ answerVF(b.getAttribute("data-vf")==="1"); }); });
      var g=area.querySelector("[data-gap]"); if(g) g.addEventListener("click",answerGap);
      var m=area.querySelector("[data-match]"); if(m) m.addEventListener("click",answerMatch);
      var nb=area.querySelector("#nextBtn"); nb.addEventListener("click",next);
    }

    function showFB(ok){
      var q=Q[idx], fb=document.getElementById("fb");
      fb.className="fb show "+(ok?"good":"bad");
      fb.textContent=(ok?"✅ ":"❌ ")+(ok?q.good:q.bad);
      document.getElementById("nextBtn").style.display="block";
      if(ok) score++;
    }
    function answerMC(i){
      var q=Q[idx], btns=area.querySelectorAll(".opt");
      btns.forEach(function(b){ b.disabled=true; });
      btns[i].classList.add(i===q.answer?"correct":"wrong");
      btns[q.answer].classList.add("correct");
      showFB(i===q.answer);
    }
    function answerVF(val){
      var q=Q[idx], btns=area.querySelectorAll(".opt");
      btns.forEach(function(b){ b.disabled=true; });
      var ok=(val===q.answer), clicked=val?0:1, correct=q.answer?0:1;
      btns[clicked].classList.add(ok?"correct":"wrong");
      btns[correct].classList.add("correct");
      showFB(ok);
    }
    function answerGap(){
      var q=Q[idx], inp=document.getElementById("gapInput");
      var v=(inp.value||"").trim().toLowerCase();
      var ok=v!=="" && q.accept.some(function(a){ return v.indexOf(a.toLowerCase())>=0; });
      inp.disabled=true;
      area.querySelector("[data-gap]").style.display="none";
      showFB(ok);
    }
    function answerMatch(){
      var q=Q[idx], allOk=true;
      q.rows.forEach(function(r,ri){
        var sel=document.getElementById("m"+ri); sel.disabled=true;
        if(sel.value===r.answer){ sel.style.borderColor="#1E8E3E"; sel.style.color="#185c2c"; }
        else { sel.style.borderColor="#C62828"; sel.style.color="#C62828"; allOk=false; }
      });
      area.querySelector("[data-match]").style.display="none";
      showFB(allOk);
    }
    function next(){ idx++; if(idx>=Q.length) end(); else render(); }
    function end(){
      bar.style.width="100%"; barTxt.textContent="Concluído!";
      var pct=score/Q.length, msg;
      if(pct===1) msg="🌟 Perfeito! Você está pronto para a prova!";
      else if(pct>=pass) msg="💚 Muito bem! Revise só o que errou e arrasa na prova.";
      else if(pct>=0.5) msg="👍 Bom começo! Volte ao guia nos temas que errou e tente de novo.";
      else msg="💪 Releia o guia com calma e tente outra vez. Você consegue!";
      area.innerHTML =
        '<div class="endscreen">' +
          '<div class="trophy">🏆</div>' +
          '<h2>Você terminou!</h2>' +
          '<div class="score">'+score+' / '+Q.length+'</div>' +
          '<p>'+msg+'</p>' +
          '<button class="btn" data-restart>🔄 Tentar de novo</button>' +
          '<button class="btn secondary" data-go="'+base+'/guia" style="margin-top:.7rem">📖 Rever o guia</button>' +
          '<button class="btn secondary" data-go="'+base+'" style="margin-top:.7rem">Voltar às atividades</button>' +
        '</div>';
      area.querySelector("[data-restart]").addEventListener("click",function(){ idx=0; score=0; render(); });
      bindGo(area);
      window.scrollTo(0,0);
    }
    render();
  }

  /* ---------- bind [data-go] ---------- */
  function bindGo(scope){
    (scope||app).querySelectorAll("[data-go]").forEach(function(n){
      n.addEventListener("click",function(){ location.hash="#/"+n.getAttribute("data-go"); });
    });
  }

  /* ============================================================
     RENDER dispatcher
     ============================================================ */
  function render(){
    var s=parse();
    try{
      if(s.length===0) return screenHome();
      if(s.length===1) return screenClasses(s[0]);
      if(s.length===2) return screenSubjects(s[0],s[1]);
      if(s.length===3) return screenTrimesters(s[0],s[1],s[2]);
      if(s.length===4) return screenActivities(s[0],s[1],s[2],s[3]);
      if(s.length>=5){
        var key=contentKey([s[0],s[1],s[2],s[3]]);
        var data=CONTENT[key];
        if(!data){ return go([s[0],s[1],s[2]]); }
        var act=find(data.activities,s[4]);
        if(!act){ return go([s[0],s[1],s[2],s[3]]); }
        if(act.type==="guide") return screenGuide(s[0],s[1],s[2],s[3],act);
        if(act.type==="quiz") return screenQuiz(s[0],s[1],s[2],s[3],act);
      }
      go([]);
    }catch(e){
      app.innerHTML='<div class="topbar"><span class="brand">🐻 BearMinds</span></div><main><div class="note">Ops! Algo deu errado. <a href="#/">Voltar ao início</a>.</div><pre style="font-size:.7rem;color:#999;white-space:pre-wrap">'+esc(e.message)+'</pre></main>';
    }
  }
})();

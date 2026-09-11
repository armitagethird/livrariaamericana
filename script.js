/* ==========================================================================
   Livraria e Papelaria Americana — comportamento
   Tudo que é visual mora em styles.css. Aqui só o que precisa de estado:
   o interruptor de animação, o retorno da newsletter e o ano do rodapé.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------- ajustes rápidos --- */
  /* Troque o número aqui e ele entra em todos os botões de WhatsApp da página.
     Formato: código do país + DDD + número, só dígitos. */
  var CONFIG = {
    whatsapp: '5599000000000',
    mensagem: 'Oi! Vi o site da Americana e quero saber sobre um produto.',
    mostrarPrecos: true,
    barraFixa: true,
    /* horário de funcionamento, por dia da semana (0 = domingo).
       null = fechado. Formato 24h. */
    horario: {
      0: null,
      1: [8, 18], 2: [8, 18], 3: [8, 18], 4: [8, 18], 5: [8, 18],
      6: [8, 13]
    }
  };

  var STORAGE_KEY = 'la-americana:motion';

  /* -------------------------------------------------- número e mensagem --- */

  function aplicarWhatsapp() {
    var href = 'https://wa.me/' + CONFIG.whatsapp +
               '?text=' + encodeURIComponent(CONFIG.mensagem);
    var links = document.querySelectorAll('a[href*="wa.me/"]');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', href);
  }

  /* --------------------------------------------------------- vitrine --- */

  function aplicarPreferencias() {
    if (!CONFIG.mostrarPrecos) {
      var precos = document.querySelectorAll('[data-price]');
      for (var i = 0; i < precos.length; i++) precos[i].hidden = true;
    }
    if (!CONFIG.barraFixa) document.body.classList.add('no-bar');
  }

  /* ------------------------------------------------------ movimento --- */
  /* O site inteiro é animado pelo rolar da página, em CSS. Este interruptor
     só liga e desliga a classe que neutraliza as timelines — nenhum conteúdo
     depende da animação para aparecer. */

  var body = document.body;
  var botao = document.getElementById('motion-toggle');
  var rotulo = document.getElementById('motion-state');

  function pintarEstado(desligada) {
    body.classList.toggle('motion-off', desligada);
    if (rotulo) rotulo.textContent = desligada ? 'desligada' : 'ligada';
    if (botao) botao.setAttribute('aria-pressed', desligada ? 'true' : 'false');
  }

  function lerPreferencia() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'off';
    } catch (e) {
      return false;
    }
  }

  function gravarPreferencia(desligada) {
    try {
      window.localStorage.setItem(STORAGE_KEY, desligada ? 'off' : 'on');
    } catch (e) { /* navegação privada: só não persiste */ }
  }

  if (botao) {
    botao.addEventListener('click', function () {
      var desligada = !body.classList.contains('motion-off');
      pintarEstado(desligada);
      gravarPreferencia(desligada);
      ajustarCena();
      pintarProgresso();
    });
  }

  /* --------------------------------------------------------- newsletter --- */
  /* Sem back-end: valida, confirma e limpa. Ligue no seu serviço trocando o
     corpo do listener por um fetch() para o endpoint de inscrição. */

  var form = document.getElementById('news-form');
  if (form) {
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      var campo = document.getElementById('news-input');
      var recado = document.getElementById('news-ok');
      var valor = campo && campo.value ? campo.value.trim() : '';
      if (!valor) { if (campo) campo.focus(); return; }
      if (recado) recado.hidden = false;
      if (campo) campo.value = '';
    });
  }

  /* ---------------------------------------------- corredores: cena presa --- */
  /* O trilho fica preso na tela e o rolar vertical anda na horizontal.
     Movemos o scrollLeft de um container de rolagem real, nunca um transform:
     assim o dedo continua funcionando, o snap volta no modo simples e, se este
     script não rodar, os quatro cartões seguem alcançáveis por arraste. */

  var scene = document.querySelector('.rail-scene');
  var stick = scene && scene.querySelector('.rail-stick');
  var trilho = scene && scene.querySelector('.rail');

  function alturaDoTopo() {
    var topo = document.querySelector('.topbar');
    if (topo) {
      document.documentElement.style.setProperty('--hd', topo.offsetHeight + 'px');
    }
  }

  function cenaSimples() {
    if (!scene) return true;
    if (body.classList.contains('motion-off')) return true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    /* tela baixa: não sobra altura para o cartão dentro da cena presa */
    return window.innerHeight < 560;
  }

  var pendente = false;

  function sincronizar() {
    pendente = false;
    if (!scene || !stick || !trilho) return;
    if (scene.classList.contains('is-plain')) return;

    var curso = scene.offsetHeight - stick.offsetHeight;      /* quanto a cena rola presa */
    var limite = trilho.scrollWidth - trilho.clientWidth;     /* quanto o trilho tem para andar */
    if (curso <= 0 || limite <= 0) return;

    var andado = window.pageYOffset - scene.offsetTop;
    var progresso = Math.min(1, Math.max(0, andado / curso));
    trilho.scrollLeft = progresso * limite;
  }

  function agendar() {
    if (pendente) return;
    pendente = true;
    window.requestAnimationFrame(sincronizar);
  }

  function ajustarCena() {
    if (!scene) return;
    scene.classList.toggle('is-plain', cenaSimples());
    if (scene.classList.contains('is-plain')) {
      trilho.scrollLeft = 0;
    } else {
      agendar();
    }
  }

  if (scene) {
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', function () {
      alturaDoTopo();
      ajustarCena();
    });
  }

  /* um só ouvinte de scroll cuida da cena presa, das faixas e do medidor */
  window.addEventListener('scroll', function () {
    var y = window.pageYOffset;
    var delta = y - ultimoY;
    ultimoY = y;
    pintarProgresso();
    if (semMovimento() || !pegarFaixas().length) return;
    empurrarFaixas(delta);
    if (!rodando) { rodando = true; window.requestAnimationFrame(girarFaixas); }
  }, { passive: true });

  window.addEventListener('resize', pintarProgresso);

  /* ------------------------------------------------ 01 · faixas no scroll --- */
  /* As duas faixas correm sozinhas. Rolar a página acelera; rolar para cima
     inverte. Quando o dedo para, a velocidade volta ao passo normal. */

  /* As animações de CSS só existem depois do primeiro cálculo de estilo, então
     a coleta é sob demanda e fica em cache na primeira vez que der certo. */
  var faixas = null;

  function pegarFaixas() {
    if (faixas && faixas.length) return faixas;
    var lista = [];
    var trilhas = document.querySelectorAll('.marquee-track');
    for (var i = 0; i < trilhas.length; i++) {
      var animacoes = trilhas[i].getAnimations ? trilhas[i].getAnimations() : [];
      for (var k = 0; k < animacoes.length; k++) lista.push(animacoes[k]);
    }
    if (lista.length) faixas = lista;
    return lista;
  }

  var ritmo = 1;          /* velocidade atual */
  var ritmoAlvo = 1;      /* para onde ela está indo */
  var ultimoY = window.pageYOffset;
  var rodando = false;

  function empurrarFaixas(delta) {
    /* 1 é o passo de repôuso; o scroll soma até 8x para frente, 5x para trás */
    ritmoAlvo = Math.max(-5, Math.min(8, 1 + delta * 0.14));
  }

  function girarFaixas() {
    var lista = pegarFaixas();
    ritmo += (ritmoAlvo - ritmo) * 0.35;
    ritmoAlvo += (1 - ritmoAlvo) * 0.03;   /* decai sozinho para o passo normal */
    for (var i = 0; i < lista.length; i++) {
      try { lista[i].playbackRate = ritmo; } catch (e) { /* ignora */ }
    }
    if (Math.abs(ritmo - 1) > 0.02 || Math.abs(ritmoAlvo - 1) > 0.02) {
      window.requestAnimationFrame(girarFaixas);
    } else {
      rodando = false;
      ritmo = 1;
      for (var j = 0; j < lista.length; j++) {
        try { lista[j].playbackRate = 1; } catch (e) { /* ignora */ }
      }
    }
  }

  /* --------------------------------------------- 02 · preços contando --- */
  /* Cada preço do ranking sobe de zero até o valor quando a linha entra em
     cena, uma vez só. O texto final é sempre o texto original do HTML. */

  function moedaBR(valor) {
    return valor.toFixed(2).replace('.', ',');
  }

  function contarPreco(elemento) {
    var original = elemento.getAttribute('data-valor') || elemento.textContent;
    var achado = original.match(/(\d+),(\d{2})/);
    if (!achado) return;
    elemento.setAttribute('data-valor', original);

    var alvo = parseFloat(achado[1] + '.' + achado[2]);
    var inicio = null;
    var duracao = 700;

    function quadro(agora) {
      if (inicio === null) inicio = agora;
      var t = Math.min(1, (agora - inicio) / duracao);
      var suave = 1 - Math.pow(1 - t, 3);          /* mesma sensação da curva CSS */
      elemento.textContent = replaceAll(original, achado[0], moedaBR(alvo * suave));
      if (t < 1) window.requestAnimationFrame(quadro);
      else elemento.textContent = original;
    }
    window.requestAnimationFrame(quadro);
  }

  function replaceAll(texto, procurar, trocar) {
    return texto.split(procurar).join(trocar);
  }

  function ligarContagem() {
    var precos = document.querySelectorAll('.rank-meta .price');
    if (!precos.length) return;
    if (!('IntersectionObserver' in window) || semMovimento()) return;

    var observador = new IntersectionObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) {
        if (entradas[i].isIntersecting) {
          contarPreco(entradas[i].target);
          observador.unobserve(entradas[i].target);
        }
      }
    }, { threshold: 0.6 });

    for (var i = 0; i < precos.length; i++) observador.observe(precos[i]);
  }

  /* ------------------------------------- 06 · contorno seguindo o cursor --- */
  /* A borda vermelha entra pelo lado por onde o mouse chegou. O CSS faz a
     transição; aqui só dizemos qual lado foi. */

  function ligarContorno() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cartoes = document.querySelectorAll('.card-cor, .card-pessoa');

    for (var i = 0; i < cartoes.length; i++) {
      cartoes[i].addEventListener('mouseenter', function (evento) {
        var caixa = this.getBoundingClientRect();
        var x = (evento.clientX - caixa.left) / caixa.width;
        var y = (evento.clientY - caixa.top) / caixa.height;
        /* qual das quatro bordas está mais perto do ponto de entrada */
        var distancias = [
          { lado: '',            d: x },          /* esquerda */
          { lado: 'from-right',  d: 1 - x },
          { lado: 'from-top',    d: y },
          { lado: 'from-bottom', d: 1 - y }
        ].sort(function (a, b) { return a.d - b.d; });

        this.classList.remove('from-right', 'from-top', 'from-bottom');
        if (distancias[0].lado) this.classList.add(distancias[0].lado);
      });
    }
  }

  /* ------------------------------------------- 07 · aberto agora de fato --- */
  /* Lê o relógio do visitante e diz a verdade: aberto e a que horas fecha,
     ou fechado e quando abre. O ponto vermelho para de piscar quando fechado. */

  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  function proximaAbertura(agora) {
    for (var salto = 1; salto <= 7; salto++) {
      var dia = (agora.getDay() + salto) % 7;
      var faixa = CONFIG.horario[dia];
      if (faixa) {
        return {
          quando: salto === 1 ? 'amanhã' : DIAS[dia],
          hora: faixa[0]
        };
      }
    }
    return null;
  }

  function situacao() {
    var agora = new Date();
    var faixa = CONFIG.horario[agora.getDay()];
    var hora = agora.getHours() + agora.getMinutes() / 60;

    if (faixa && hora >= faixa[0] && hora < faixa[1]) {
      return { aberto: true, fecha: faixa[1] };
    }
    /* ainda vai abrir hoje */
    if (faixa && hora < faixa[0]) {
      return { aberto: false, quando: 'hoje', hora: faixa[0] };
    }
    var proxima = proximaAbertura(agora);
    if (!proxima) return { aberto: false, quando: null };
    return { aberto: false, quando: proxima.quando, hora: proxima.hora };
  }

  function aplicarSituacao() {
    var s = situacao();
    var noHero = document.getElementById('status-hero');
    var nasLojas = document.getElementById('status-lojas');
    var pontos = [document.getElementById('dot-hero'), document.getElementById('dot-lojas')];

    var frase, fraseLojas;
    if (s.aberto) {
      frase = 'Presidente Dutra · duas lojas · aberto agora';
      fraseLojas = 'Aberto agora · fecha às ' + s.fecha + 'h';
    } else if (s.quando) {
      frase = 'Presidente Dutra · duas lojas · abre ' + s.quando + ' às ' + s.hora + 'h';
      fraseLojas = 'Fechado agora · abre ' + s.quando + ' às ' + s.hora + 'h';
    } else {
      frase = 'Presidente Dutra · duas lojas';
      fraseLojas = 'Consulte o horário pelo WhatsApp';
    }

    if (noHero) noHero.textContent = frase;
    if (nasLojas) nasLojas.textContent = fraseLojas;
    for (var i = 0; i < pontos.length; i++) {
      if (pontos[i]) pontos[i].classList.toggle('dot--off', !s.aberto);
    }
  }

  function semMovimento() {
    return body.classList.contains('motion-off') ||
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* --------------------------------------- 03 · medidor de progresso --- */
  /* O anel marca quanto do site já foi lido e o selo gira no mesmo ritmo:
     100% de leitura é uma volta completa. O anel é informação, então continua
     funcionando com o movimento desligado; só o giro do selo para. */

  var VOLTA = 282.74;   /* 2πr, r = 45 no viewBox do SVG */

  /* o anel atravessa as três cores enquanto você lê: começa no vermelho da
     marca, passa pelo amarelo da bandeira e fecha no verde. É o único lugar
     do site onde as três aparecem juntas, e elas aparecem em sequência, nunca
     ao mesmo tempo. */
  var PARADAS = [
    { p: 0.00, cor: [216, 20, 32] },
    { p: 0.50, cor: [255, 223, 0] },
    { p: 1.00, cor: [0, 151, 57] }
  ];

  function corDoProgresso(lido) {
    for (var i = 1; i < PARADAS.length; i++) {
      if (lido <= PARADAS[i].p) {
        var a = PARADAS[i - 1], b = PARADAS[i];
        var t = (b.p - a.p) === 0 ? 0 : (lido - a.p) / (b.p - a.p);
        var canal = [];
        for (var k = 0; k < 3; k++) {
          canal.push(Math.round(a.cor[k] + (b.cor[k] - a.cor[k]) * t));
        }
        return 'rgb(' + canal.join(',') + ')';
      }
    }
    var fim = PARADAS[PARADAS.length - 1].cor;
    return 'rgb(' + fim.join(',') + ')';
  }

  var medidor = document.getElementById('progresso');
  var arco = document.getElementById('progresso-arco');
  var seloGirando = document.getElementById('progresso-selo');

  function pintarProgresso() {
    if (!medidor || !arco) return;
    var altura = document.documentElement.scrollHeight - window.innerHeight;
    var lido = altura > 0 ? Math.min(1, Math.max(0, window.pageYOffset / altura)) : 0;

    arco.style.strokeDashoffset = String(VOLTA * (1 - lido));
    arco.style.stroke = corDoProgresso(lido);
    medidor.setAttribute('aria-label', 'Leitura em ' + Math.round(lido * 100) + '%. Voltar ao topo');
    if (seloGirando && !semMovimento()) {
      seloGirando.style.transform = 'rotate(' + (lido * 360).toFixed(1) + 'deg)';
    }
    /* só aparece depois que a leitura começou, para não poluir a abertura */
    medidor.classList.toggle('aparece', window.pageYOffset > 240);
  }

  /* -------------------------------------------------------------- ano --- */

  var ano = document.getElementById('ano');
  if (ano) ano.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------- início --- */

  aplicarWhatsapp();
  aplicarPreferencias();
  pintarEstado(lerPreferencia());
  alturaDoTopo();
  ajustarCena();
  aplicarSituacao();
  ligarContorno();
  ligarContagem();
  pintarProgresso();
  window.setInterval(aplicarSituacao, 60000);   /* mantém o status honesto */
})();

#!/usr/bin/env python3
# =============================================================================
#  RT-VH · RASTREADOR TÁTICO DE VESTÍGIOS HUMANOS
#  Versão Python para Pydroid 3 (Android) — Coleta de Dados em Campo
#  PMES / Batalhão de Ações com Cães (BAC)
#  Referência: Livro BPR-8 — Análise Biomecânica Forense e Engenharia de Precisão
# =============================================================================
#
#  COMO USAR NO PYDROID 3:
#  1. Abra este arquivo no Pydroid 3
#  2. Toque em ▶ para executar
#  3. A interface abrirá automaticamente
#  4. Ao encerrar, os dados são salvos em:
#     /sdcard/rtvh_dados.json  (backup completo)
#     /sdcard/rtvh_campo.csv   (planilha para análise posterior)
#
# =============================================================================
#  PARÂMETROS EDITÁVEIS — ajuste antes de ir a campo
# =============================================================================

# --- Dados do rastreador (calibração de peso — Cap.4) ----------------------
RASTREADOR_PESO_KG   = 80      # seu peso corporal em kg
RASTREADOR_PROF_MM   = 0       # sua profundidade de pegada no solo atual (mm)
                                # preencha no início de cada missão

# --- Solo padrão da missão (pode ser alterado por pegada) ------------------
# Opções: "baixo"  → Areia fofa / Neve fresca / Solo arado
#          "medio" → Solo florestal úmido / Gramado / Lama
#          "alto"  → Cascalho / Argila seca
SOLO_PADRAO = "medio"

# --- Operador / Missão (para cabeçalho do relatório) -----------------------
OPERADOR    = "Rastreador BAC"
MISSAO_ID   = "MISSAO_001"
LOCAL       = "Área Rural - ES"

# --- Caminhos de saída de dados --------------------------------------------
ARQUIVO_JSON = "/sdcard/rtvh_dados.json"
ARQUIVO_CSV  = "/sdcard/rtvh_campo.csv"
# Em caso de erro de permissão, os arquivos serão salvos localmente:
ARQUIVO_JSON_LOCAL = "rtvh_dados.json"
ARQUIVO_CSV_LOCAL  = "rtvh_campo.csv"

# =============================================================================
#  MOTOR BIOMECÂNICO — Equações exatas do livro BPR-8 / RT-VH
# =============================================================================

def calcular_estatura(comp_cm, sexo, lado="D"):
    """
    Cap.3 — Estimativa de estatura por comprimento plantar
    Equações de regressão com SEE de 6,6 a 8,7 cm
    """
    if not comp_cm or comp_cm <= 0:
        return None
    f = float(comp_cm)
    if sexo == "M":
        if lado == "D":
            est = 86.89 + 3.49 * f; see = 7.2; eq = "86,89 + 3,49 × RFPL"
        else:
            est = 90.15 + 3.34 * f; see = 7.2; eq = "90,15 + 3,34 × LFPL"
    elif sexo == "F":
        if lado == "D":
            est = 58.93 + 4.42 * f; see = 8.7; eq = "58,93 + 4,42 × RFPL"
        else:
            est = 63.20 + 4.28 * f; see = 8.7; eq = "63,20 + 4,28 × LFPL (var.)"
    else:  # Indefinido — média das equações masculina e feminina
        mR = 86.89 + 3.49 * f
        fR = 58.93 + 4.42 * f
        est = (mR + fR) / 2; see = 9.8; eq = "média M+F (sexo indet.)"
    return {
        "est": round(est, 1),
        "min": round(est - see, 1),
        "max": round(est + see, 1),
        "see": see,
        "eq": eq
    }


def calcular_sexo(comp_cm, larg_cm=None, passada_cm=None, angulo=None, base=None):
    """
    Cap.5 — Estimativa de sexo por múltiplos indicadores biomecânicos
    Retorna: {"sexo": "M"/"F"/"?", "conf": int, "detalhes": [...]}
    """
    score = 0
    signals = 0
    detalhes = []

    # 1. Índice morfológico largura/comprimento (Cap.5 — principal)
    if comp_cm and larg_cm:
        r = float(larg_cm) / float(comp_cm)
        if   r >= 0.44:  score += 2; detalhes.append(f"Índice L/C={r:.3f} ≥0,44 → ♂ forte")
        elif r >= 0.425: score += 1; detalhes.append(f"Índice L/C={r:.3f} → ♂ moderado")
        elif r >= 0.40:  score += 0; detalhes.append(f"Índice L/C={r:.3f} → zona mista")
        elif r >= 0.385: score -= 1; detalhes.append(f"Índice L/C={r:.3f} → ♀ moderado")
        else:             score -= 2; detalhes.append(f"Índice L/C={r:.3f} <0,385 → ♀ forte")
        signals += 1

    # 2. Comprimento da passada (Cap.2 — ref ♂:158cm / ♀:132cm)
    if passada_cm:
        s = float(passada_cm)
        if   s >= 150: score += 2; detalhes.append(f"Passada {s}cm → ♂ (ref.158cm)")
        elif s >= 135: score += 1; detalhes.append(f"Passada {s}cm → ♂ limítrofe")
        elif s >= 118: score += 0; detalhes.append(f"Passada {s}cm → zona mista")
        elif s >= 100: score -= 1; detalhes.append(f"Passada {s}cm → ♀ limítrofe")
        else:           score -= 2; detalhes.append(f"Passada {s}cm → ♀ (ref.132cm)")
        signals += 1

    # 3. Ângulo do pé (Cap.5 — ♂:>7° toed-out / ♀:<6° toed-in)
    if angulo is not None and angulo != "":
        a = float(angulo)
        if   a > 8: score += 1; detalhes.append(f"Ângulo {a}° toed-out → ♂ (ref.>7°)")
        elif a < 4: score -= 1; detalhes.append(f"Ângulo {a}° toed-in → ♀ (ref.<6°)")
        signals += 1

    # 4. Base de marcha (Cap.2 — ♂:8,1cm / ♀:7,1cm)
    if base is not None and base != "":
        b = float(base)
        if   b >= 8.5: score += 1; detalhes.append(f"Base {b}cm larga → ♂ (ref.8,1cm)")
        elif b < 6.0:  score -= 1; detalhes.append(f"Base {b}cm estreita → ♀ (ref.7,1cm)")
        signals += 1

    if not signals:
        return None

    pct = score / (signals * 2)
    if   pct >  0.60: sexo = "M"; conf = min(95, int(70 + pct * 30))
    elif pct >  0.25: sexo = "M"; conf = min(78, int(52 + pct * 30))
    elif pct > -0.25: sexo = "?"; conf = 45
    elif pct > -0.60: sexo = "F"; conf = min(78, int(52 + (-pct) * 30))
    else:              sexo = "F"; conf = min(95, int(70 + (-pct) * 30))

    return {"sexo": sexo, "conf": conf, "score": score, "signals": signals, "detalhes": detalhes}


def calcular_velocidade(passada_cm):
    """
    Cap.2 — V = SL × cadência / 60
    Cadência ref: 117 passos/min = 58,5 passadas/min
    """
    if not passada_cm or float(passada_cm) <= 0:
        return None
    sl = float(passada_cm)
    ms = (sl / 100.0) * (117.0 / 2.0) / 60.0
    kmh = ms * 3.6
    if   sl < 100: gait = "Caminhada lenta";  nota = "Calcanhar claro, rolagem suave"
    elif sl < 140: gait = "Caminhada normal"; nota = "Fase de apoio plena, impulso pelos dedos"
    elif sl < 200: gait = "Marcha rápida";    nota = "Impulso forte, calcanhar ainda presente"
    else:           gait = "Corrida / Trote";  nota = "Antepé profundo, calcanhar ausente, fase de voo"
    return {"ms": round(ms, 2), "kmh": round(kmh, 1), "gait": gait, "nota": nota, "sl": sl}


def calcular_peso(estatura, solo="medio", peso_rastreador=None, prof_sujeito=None, prof_rastreador=None):
    """
    Cap.4 — Estimativa de peso por calibração comparativa
    Sem calibração: usa IMC referência Brasil 24,5 (IBGE 2020)
    Com calibração: razão de profundidade × peso do rastreador
    """
    if not estatura:
        return None
    h = estatura / 100.0
    est = 24.5 * h * h  # IMC ref IBGE 2020
    metodo = "IMC ref. Brasil 24,5 (IBGE 2020)"
    nota_solo = {
        "baixo": "Areia/neve: pegadas profundas mesmo leves — conf. baixa",
        "medio": "Solo úmido/lama: profundidade proporcional à massa — conf. moderada",
        "alto":  "Cascalho/argila: sinais superficiais, analisar pressões de liberação"
    }.get(solo, "")

    if peso_rastreador and prof_sujeito and prof_rastreador:
        pr = float(peso_rastreador)
        ps = float(prof_sujeito)
        pt = float(prof_rastreador)
        if pt > 0 and ps > 0:
            ratio = ps / pt
            est = pr * ratio
            metodo = f"Calibração comparativa Cap.4: {pr:.0f}kg × ({ps:.0f}/{pt:.0f}mm)"

    return {
        "est": round(est),
        "min": round(est - 16),
        "max": round(est + 22),
        "metodo": metodo,
        "nota_solo": nota_solo
    }


def calcular_perfil(pegadas, cfg=None):
    """Consolida todas as pegadas em um perfil biométrico único."""
    if cfg is None:
        cfg = {}
    if not pegadas:
        return None

    def media(campo):
        vals = [float(p[campo]) for p in pegadas if p.get(campo) not in (None, "", 0)]
        return sum(vals) / len(vals) if vals else None

    avg_fl     = media("comp_cm")
    avg_fw     = media("larg_cm")
    avg_sl     = media("passada_cm")
    avg_depth  = media("prof_mm")
    avg_angle  = media("angulo")
    avg_base   = media("base_cm")

    # Lado mais frequente
    lados = [p.get("lado", "D") for p in pegadas]
    lado = "D" if lados.count("D") >= len(lados) / 2 else "E"

    sex_est  = calcular_sexo(avg_fl, avg_fw, avg_sl, avg_angle, avg_base)
    sexo     = sex_est["sexo"] if sex_est and sex_est["sexo"] != "?" else None
    stat_est = calcular_estatura(avg_fl, sexo or "?", lado)
    vel_est  = calcular_velocidade(avg_sl) if avg_sl else None
    peso_est = calcular_peso(
        stat_est["est"] if stat_est else None,
        cfg.get("solo", SOLO_PADRAO),
        cfg.get("peso_rastreador", RASTREADOR_PESO_KG if RASTREADOR_PROF_MM > 0 else None),
        avg_depth,
        cfg.get("prof_rastreador", RASTREADOR_PROF_MM if RASTREADOR_PROF_MM > 0 else None)
    )

    base  = len(pegadas) * 18
    bonus = (12 if avg_fw   else 0) + (10 if avg_sl    else 0) + \
            (5  if avg_angle else 0) + (5  if avg_base  else 0) + \
            (4  if avg_depth else 0)
    conf = min(97, base + bonus)

    return {
        "n_pegadas": len(pegadas),
        "avg_fl":    round(avg_fl, 1)    if avg_fl    else None,
        "avg_fw":    round(avg_fw, 1)    if avg_fw    else None,
        "avg_sl":    round(avg_sl, 1)    if avg_sl    else None,
        "avg_depth": round(avg_depth, 1) if avg_depth else None,
        "lado":      lado,
        "sexo":      sex_est,
        "estatura":  stat_est,
        "velocidade":vel_est,
        "peso":      peso_est,
        "conf":      conf
    }

# =============================================================================
#  PERSISTÊNCIA DE DADOS
# =============================================================================

import json, csv, os, datetime

def salvar_json(dados):
    """Tenta /sdcard primeiro, cai para diretório local."""
    for caminho in [ARQUIVO_JSON, ARQUIVO_JSON_LOCAL]:
        try:
            with open(caminho, "w", encoding="utf-8") as f:
                json.dump(dados, f, ensure_ascii=False, indent=2, default=str)
            return caminho
        except Exception:
            continue
    return None

def carregar_json():
    for caminho in [ARQUIVO_JSON, ARQUIVO_JSON_LOCAL]:
        if os.path.exists(caminho):
            try:
                with open(caminho, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return None

def exportar_csv(pegadas, caminho_base):
    """Exporta pegadas em CSV para análise posterior no Excel/Python."""
    campos = ["id","ts","tipo","lado","comp_cm","larg_cm","passada_cm","base_cm",
              "angulo","prof_mm","solo_local","notas",
              "est_sexo","est_conf","est_estatura","est_vel_kmh"]
    for caminho in [caminho_base, ARQUIVO_CSV_LOCAL]:
        try:
            with open(caminho, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
                w.writeheader()
                for p in pegadas:
                    # Pré-calcula estimativas por pegada individual
                    s = calcular_sexo(p.get("comp_cm"), p.get("larg_cm"),
                                      p.get("passada_cm"), p.get("angulo"), p.get("base_cm"))
                    sexo = s["sexo"] if s and s["sexo"] != "?" else None
                    st   = calcular_estatura(p.get("comp_cm"), sexo or "?", p.get("lado","D"))
                    vel  = calcular_velocidade(p.get("passada_cm"))
                    row = dict(p)
                    row["est_sexo"]     = s["sexo"]   if s   else ""
                    row["est_conf"]     = s["conf"]   if s   else ""
                    row["est_estatura"] = st["est"]   if st  else ""
                    row["est_vel_kmh"]  = vel["kmh"]  if vel else ""
                    w.writerow(row)
            return caminho
        except Exception:
            continue
    return None

# =============================================================================
#  INTERFACE TKINTER — compatível com Pydroid 3
# =============================================================================

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

DARK  = "#050f08"
PANEL = "#0b1a12"
GREEN = "#00e676"
DIM   = "#2d5a3d"
MUTED = "#7ab88a"
RED   = "#ff1744"
AMBER = "#ff8f00"
BLUE  = "#4fc3f7"
PINK  = "#f48fb1"
FONT  = ("Courier", 10)
FONTB = ("Courier", 10, "bold")
FONTL = ("Courier", 9)

class RTVHApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("RT-VH · Rastreamento Tático de Vestígios Humanos · PMES/BAC")
        self.configure(bg=DARK)
        self.geometry("420x720")
        self.resizable(True, True)

        self.missao_ativa = False
        self.t_inicio     = None
        self.evidencias   = []
        self.cfg          = {
            "solo":            SOLO_PADRAO,
            "peso_rastreador": RASTREADOR_PESO_KG,
            "prof_rastreador": RASTREADOR_PROF_MM
        }

        # Carrega dados anteriores se existirem
        dados = carregar_json()
        if dados:
            self.evidencias = dados.get("evidencias", [])
            self.cfg.update(dados.get("cfg", {}))

        self._build_ui()
        self._atualizar_status()

    # ── CONSTRUÇÃO DA UI ──────────────────────────────────────────────────

    def _build_ui(self):
        # Header
        hdr = tk.Frame(self, bg="#07100d", pady=8, padx=14)
        hdr.pack(fill="x")
        tk.Label(hdr, text="RT-VH · RASTREAMENTO TÁTICO", fg=GREEN, bg="#07100d",
                 font=("Courier", 13, "bold")).pack(anchor="w")
        tk.Label(hdr, text=f"VESTÍGIOS HUMANOS · PMES / BAC — Batalhão de Ações com Cães  |  {MISSAO_ID}",
                 fg=DIM, bg="#07100d", font=FONTL).pack(anchor="w")

        # Notebook (abas)
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TNotebook",        background=DARK, borderwidth=0)
        style.configure("TNotebook.Tab",    background=PANEL, foreground=DIM,
                        font=FONTL, padding=[10, 5], borderwidth=0)
        style.map("TNotebook.Tab",
                  background=[("selected", "#0f2a1a")],
                  foreground=[("selected", GREEN)])
        style.configure("TFrame", background=DARK)

        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=4, pady=4)

        self.tab_missao   = ttk.Frame(self.nb)
        self.tab_pegada   = ttk.Frame(self.nb)
        self.tab_lista    = ttk.Frame(self.nb)
        self.tab_analise  = ttk.Frame(self.nb)
        self.tab_config   = ttk.Frame(self.nb)

        self.nb.add(self.tab_missao,  text="MISSÃO")
        self.nb.add(self.tab_pegada,  text="PEGADA")
        self.nb.add(self.tab_lista,   text="LISTA")
        self.nb.add(self.tab_analise, text="ANÁLISE")
        self.nb.add(self.tab_config,  text="CONFIG")

        self._tab_missao()
        self._tab_pegada()
        self._tab_lista()
        self._tab_analise()
        self._tab_config()

    # ── ABA MISSÃO ────────────────────────────────────────────────────────

    def _tab_missao(self):
        f = self.tab_missao
        f.configure(style="TFrame")
        self._panel(f, "STATUS DA MISSÃO").pack(fill="x", padx=8, pady=(8,4))

        # Grid de status
        gf = tk.Frame(f, bg=PANEL, padx=8, pady=4)
        gf.pack(fill="x", padx=8)
        self.lbl_status   = self._stat(gf, "STATUS",     "○ AGUARDANDO", 0, 0, DIM)
        self.lbl_tempo    = self._stat(gf, "TEMPO",      "00:00:00",     0, 1, GREEN)
        self.lbl_nev      = self._stat(gf, "EVIDÊNCIAS", "0",            1, 0, GREEN)
        self.lbl_npeg     = self._stat(gf, "PEGADAS",    "0",            1, 1, GREEN)

        bf = tk.Frame(f, bg=DARK, pady=8, padx=8)
        bf.pack(fill="x")
        self.btn_missao = tk.Button(bf, text="▶  INICIAR MISSÃO", bg=PANEL,
                                     fg=GREEN, font=FONTB, relief="flat",
                                     bd=1, highlightbackground=GREEN,
                                     command=self._toggle_missao, pady=10)
        self.btn_missao.pack(fill="x", pady=2)

        self.btn_nova_ev = tk.Button(bf, text="+  NOVA EVIDÊNCIA", bg=PANEL,
                                      fg=AMBER, font=FONTB, relief="flat",
                                      bd=1, highlightbackground=AMBER,
                                      command=self._ir_pegada, pady=10,
                                      state="disabled")
        self.btn_nova_ev.pack(fill="x", pady=2)

        # Notas rápidas de campo
        self._panel(f, "NOTA RÁPIDA DE CAMPO").pack(fill="x", padx=8, pady=(8,2))
        self.nota_campo = tk.Text(f, height=4, bg=PANEL, fg=MUTED, font=FONTL,
                                   insertbackground=GREEN, relief="flat",
                                   padx=6, pady=4)
        self.nota_campo.pack(fill="x", padx=8)

        # Calibração rápida de solo
        scf = self._panel(f, "SOLO ATUAL (Cap.4)"); scf.pack(fill="x", padx=8, pady=4)
        self.solo_var = tk.StringVar(value=self.cfg["solo"])
        for v, t in [("baixo","Areia/Neve"), ("medio","Solo Úmido"), ("alto","Cascalho")]:
            tk.Radiobutton(scf, text=t, variable=self.solo_var, value=v,
                           bg=PANEL, fg=MUTED, selectcolor="#0f2a1a",
                           activebackground=PANEL, font=FONTL,
                           command=lambda: self.cfg.update({"solo": self.solo_var.get()})
                           ).pack(anchor="w", padx=4)

        tk.Button(f, text="💾  SALVAR DADOS DE CAMPO", bg=PANEL, fg=GREEN,
                  font=FONTL, relief="flat", command=self._salvar, pady=8
                  ).pack(fill="x", padx=8, pady=8)

    def _stat(self, parent, label, valor, r, c, cor):
        fr = tk.Frame(parent, bg=PANEL, padx=8, pady=4)
        fr.grid(row=r, column=c, sticky="ew", padx=2, pady=2)
        parent.columnconfigure(c, weight=1)
        tk.Label(fr, text=label, fg=DIM, bg=PANEL, font=FONTL).pack(anchor="w")
        lbl = tk.Label(fr, text=str(valor), fg=cor, bg=PANEL, font=FONTB)
        lbl.pack(anchor="w")
        return lbl

    # ── ABA PEGADA ────────────────────────────────────────────────────────

    def _tab_pegada(self):
        f = self.tab_pegada
        canvas = tk.Canvas(f, bg=DARK, highlightthickness=0)
        sb = ttk.Scrollbar(f, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        inner = tk.Frame(canvas, bg=DARK)
        cw = canvas.create_window((0, 0), window=inner, anchor="nw")
        def _resize(e):
            canvas.configure(scrollregion=canvas.bbox("all"))
            canvas.itemconfig(cw, width=e.width)
        inner.bind("<Configure>", _resize)
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(cw, width=e.width))
        self._form_pegada(inner)

    def _form_pegada(self, parent):
        self.fp = {}  # campos do formulário

        def sec(title):
            p = self._panel(parent, title)
            p.pack(fill="x", padx=8, pady=(6,2))
            return p

        # Tipo de evidência
        tp = sec("TIPO DE EVIDÊNCIA")
        self.fp["tipo"] = tk.StringVar(value="pegada")
        tipos = [("👣 PEGADA","pegada"),("🔍 VESTÍGIO","vestigio"),
                 ("⚠️ DEJETO","dejeto"),("🌿 GALHO","galho"),("🩸 SANGUE","sangue")]
        row = tk.Frame(tp, bg=PANEL)
        row.pack(fill="x", padx=4)
        for t, v in tipos:
            tk.Radiobutton(row, text=t, variable=self.fp["tipo"], value=v,
                           bg=PANEL, fg=MUTED, selectcolor="#0f2a1a",
                           activebackground=PANEL, font=FONTL
                           ).pack(side="left", padx=2)

        # Lado do pé
        lp = sec("PÉ (define equação Cap.3)")
        self.fp["lado"] = tk.StringVar(value="D")
        lf = tk.Frame(lp, bg=PANEL)
        lf.pack(fill="x", padx=4, pady=2)
        for t, v in [("PÉ DIREITO (RFPL)","D"),("PÉ ESQUERDO (LFPL)","E")]:
            tk.Radiobutton(lf, text=t, variable=self.fp["lado"], value=v,
                           bg=PANEL, fg=MUTED, selectcolor="#0f2a1a",
                           activebackground=PANEL, font=FONTL
                           ).pack(side="left", padx=6)

        # Medidas — Cap.3
        mp = sec("MEDIDAS PLANTARES (Cap.3)")
        campos_m = [
            ("comp_cm",    "Comprimento plantar (cm)",    "ex: 26.5  — RFPL/LFPL"),
            ("larg_cm",    "Largura do pé (cm)",          "ex: 9.8"),
            ("passada_cm", "Passada CTR–CTR (cm)",        "♂ ref:158  ♀ ref:132"),
            ("base_cm",    "Base de marcha (cm)",         "♂ ref:8,1  ♀ ref:7,1"),
            ("angulo",     "Ângulo do pé (°)",            "♂ >7° toed-out  ♀ <6°"),
            ("prof_mm",    "Profundidade da pegada (mm)", "ex: 14"),
        ]
        for key, lbl, ph in campos_m:
            tk.Label(mp, text=lbl, fg=DIM, bg=PANEL, font=FONTL).pack(anchor="w", padx=4)
            e = tk.Entry(mp, bg="#07100d", fg=GREEN, font=FONT,
                         insertbackground=GREEN, relief="flat")
            e.insert(0, ph)
            e.bind("<FocusIn>",  lambda ev, p=ph, w=e: (w.delete(0,"end") if w.get()==p else None))
            e.bind("<FocusOut>", lambda ev, p=ph, w=e: (w.insert(0,p) if w.get()=="" else None))
            e.pack(fill="x", padx=4, pady=(0,6))
            # dispara pré-análise a cada digitação
            e.bind("<KeyRelease>", lambda ev: self._pre_analise())
            self.fp[key] = e

        # Solo local
        slp = sec("SOLO LOCAL (Cap.4)")
        self.fp["solo_local"] = tk.StringVar(value=self.cfg["solo"])
        for v, t in [("baixo","Areia/Neve/Solo Arado"),
                     ("medio","Solo Úmido/Gramado/Lama"),
                     ("alto","Cascalho/Argila Seca")]:
            tk.Radiobutton(slp, text=t, variable=self.fp["solo_local"], value=v,
                           bg=PANEL, fg=MUTED, selectcolor="#0f2a1a",
                           activebackground=PANEL, font=FONTL
                           ).pack(anchor="w", padx=4)

        # Observações
        np = sec("OBSERVAÇÕES")
        self.fp["notas"] = tk.Text(np, height=3, bg="#07100d", fg=MUTED,
                                    font=FONTL, insertbackground=GREEN,
                                    relief="flat", padx=6, pady=4)
        self.fp["notas"].pack(fill="x", padx=4, pady=2)

        # Pré-análise em tempo real
        pp = sec("PRÉ-ANÁLISE EM TEMPO REAL")
        self.lbl_pre = tk.Label(pp, text="— insira o comprimento do pé para iniciar —",
                                fg=DIM, bg=PANEL, font=FONTL, justify="left",
                                wraplength=360, anchor="w")
        self.lbl_pre.pack(fill="x", padx=4, pady=4)

        # Botão registrar
        tk.Button(parent, text="✓  REGISTRAR EVIDÊNCIA", bg="#0f2a1a",
                  fg=GREEN, font=FONTB, relief="flat",
                  highlightbackground=GREEN, command=self._registrar, pady=12
                  ).pack(fill="x", padx=8, pady=8)

    def _get_fp_val(self, key):
        """Retorna valor numérico do campo ou None."""
        try:
            w = self.fp[key]
            val = w.get().strip() if isinstance(w, tk.Entry) else None
            if not val or not any(c.isdigit() for c in val):
                return None
            return float(val.replace(",", "."))
        except Exception:
            return None

    def _pre_analise(self):
        """Atualiza rótulo de pré-análise em tempo real."""
        comp = self._get_fp_val("comp_cm")
        if not comp:
            self.lbl_pre.config(text="— insira o comprimento do pé para iniciar —", fg=DIM)
            return
        larg   = self._get_fp_val("larg_cm")
        pass_  = self._get_fp_val("passada_cm")
        ang    = self._get_fp_val("angulo")
        base   = self._get_fp_val("base_cm")
        lado   = self.fp["lado"].get()

        sex_e  = calcular_sexo(comp, larg, pass_, ang, base)
        sexo   = sex_e["sexo"] if sex_e and sex_e["sexo"] != "?" else None
        stat_e = calcular_estatura(comp, sexo or "?", lado)
        vel_e  = calcular_velocidade(pass_) if pass_ else None

        linhas = []
        if sex_e:
            s = sex_e["sexo"]
            linhas.append(f"SEXO: {'♂ MASCULINO' if s=='M' else '♀ FEMININO' if s=='F' else '? INDET.'} ({sex_e['conf']}%) — {sex_e['signals']} indicador(es)")
        if stat_e:
            linhas.append(f"ESTATURA: {stat_e['min']}–{stat_e['max']} cm (±{stat_e['see']}cm)")
            linhas.append(f"Eq: Ht = {stat_e['eq']}")
        if vel_e:
            linhas.append(f"MARCHA: {vel_e['gait']}")
            linhas.append(f"VELOCIDADE: {vel_e['kmh']} km/h  ({vel_e['ms']} m/s)")
            linhas.append(f"Morfologia: {vel_e['nota']}")

        self.lbl_pre.config(text="\n".join(linhas) if linhas else "— —", fg=GREEN)

    def _registrar(self):
        tipo = self.fp["tipo"].get()
        ev = {
            "id":        len(self.evidencias) + 1,
            "ts":        datetime.datetime.now().strftime("%H:%M:%S"),
            "tipo":      tipo,
            "lado":      self.fp["lado"].get(),
            "solo_local":self.fp["solo_local"].get(),
            "notas":     self.fp["notas"].get("1.0", "end").strip()
        }
        if tipo == "pegada":
            for k in ["comp_cm","larg_cm","passada_cm","base_cm","angulo","prof_mm"]:
                ev[k] = self._get_fp_val(k)

        self.evidencias.append(ev)
        self._atualizar_status()
        self._atualizar_lista()
        messagebox.showinfo("RT-VH", f"✓ {LABELS.get(tipo, tipo)} registrado(a)!\nTotal: {len(self.evidencias)} evidências")
        # Limpa campos numéricos
        for k in ["comp_cm","larg_cm","passada_cm","base_cm","angulo","prof_mm"]:
            w = self.fp.get(k)
            if isinstance(w, tk.Entry):
                w.delete(0, "end")
        self.fp["notas"].delete("1.0", "end")
        self.lbl_pre.config(text="— insira o comprimento do pé para iniciar —", fg=DIM)
        self.nb.select(self.tab_lista)

    # ── ABA LISTA ─────────────────────────────────────────────────────────

    def _tab_lista(self):
        f = self.tab_lista
        toolbar = tk.Frame(f, bg=DARK)
        toolbar.pack(fill="x", padx=8, pady=4)
        tk.Button(toolbar, text="🗑 LIMPAR TUDO", bg=PANEL, fg=RED,
                  font=FONTL, relief="flat", command=self._limpar
                  ).pack(side="right")
        tk.Button(toolbar, text="📊 EXPORTAR CSV", bg=PANEL, fg=MUTED,
                  font=FONTL, relief="flat", command=self._exportar_csv
                  ).pack(side="right", padx=4)
        self.lista_text = scrolledtext.ScrolledText(
            f, bg=PANEL, fg=MUTED, font=FONTL, relief="flat",
            state="disabled", wrap="word"
        )
        self.lista_text.pack(fill="both", expand=True, padx=8, pady=4)
        self._atualizar_lista()

    def _atualizar_lista(self):
        self.lista_text.config(state="normal")
        self.lista_text.delete("1.0", "end")
        if not self.evidencias:
            self.lista_text.insert("end", "\n  Nenhuma evidência registrada.\n")
        for ev in reversed(self.evidencias):
            tipo = ev.get("tipo","?")
            icon = {"pegada":"👣","vestigio":"🔍","dejeto":"⚠️","galho":"🌿","sangue":"🩸"}.get(tipo,"·")
            self.lista_text.insert("end", f"\n{icon} [{ev['id']:03d}] {tipo.upper()}  {ev['ts']}\n")
            if tipo == "pegada":
                for k, l in [("comp_cm","Comp"),("larg_cm","Larg"),("passada_cm","Passada"),
                              ("prof_mm","Prof"),("angulo","Ângulo"),("base_cm","Base")]:
                    v = ev.get(k)
                    if v: self.lista_text.insert("end", f"  {l}: {v}\n")
            if ev.get("notas"):
                self.lista_text.insert("end", f"  Obs: {ev['notas']}\n")
            self.lista_text.insert("end", "  " + "─"*36 + "\n")
        self.lista_text.config(state="disabled")

    # ── ABA ANÁLISE ───────────────────────────────────────────────────────

    def _tab_analise(self):
        f = self.tab_analise
        tk.Button(f, text="⟳  ATUALIZAR ANÁLISE", bg="#0f2a1a",
                  fg=GREEN, font=FONTB, relief="flat", command=self._mostrar_analise, pady=8
                  ).pack(fill="x", padx=8, pady=8)
        self.analise_text = scrolledtext.ScrolledText(
            f, bg=PANEL, fg=MUTED, font=FONTL, relief="flat",
            state="disabled", wrap="word"
        )
        self.analise_text.pack(fill="both", expand=True, padx=8, pady=4)
        self._mostrar_analise()

    def _mostrar_analise(self):
        self.analise_text.config(state="normal")
        self.analise_text.delete("1.0", "end")

        pegadas = [e for e in self.evidencias if e.get("tipo") == "pegada" and e.get("comp_cm")]
        if not pegadas:
            self.analise_text.insert("end", "\n  Registre pegadas para iniciar\n  a análise biomecânica (Cap.3–5).\n")
            self.analise_text.config(state="disabled")
            return

        p = calcular_perfil(pegadas, self.cfg)
        if not p:
            self.analise_text.insert("end", "\n  Dados insuficientes.\n")
            self.analise_text.config(state="disabled")
            return

        W = 42
        def linha(t=""): self.analise_text.insert("end", t + "\n")
        def sep(): linha("─"*W)
        def titulo(t): linha(); sep(); linha(f"  {t}"); sep()

        linha(f"  RT-VH · RASTREADOR TÁTICO DE VESTÍGIOS HUMANOS")
        linha(f"  {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}  ·  {MISSAO_ID}")
        linha(f"  Operador: {OPERADOR}  ·  Local: {LOCAL}")
        sep()

        # Confiança
        c = p["conf"]
        bar = "█" * int(c/5) + "░" * (20 - int(c/5))
        linha(f"  CONFIANÇA DO PERFIL")
        linha(f"  [{bar}] {c}%")
        linha(f"  {p['n_pegadas']} pegada(s) analisada(s)")

        # Sexo
        if p["sexo"]:
            titulo("SEXO ESTIMADO  ·  CAP.5")
            sx = p["sexo"]
            sim = "♂ MASCULINO" if sx["sexo"]=="M" else "♀ FEMININO" if sx["sexo"]=="F" else "? INDETERMINADO"
            linha(f"  {sim}  ({sx['conf']}%)")
            linha(f"  {sx['signals']} indicador(es) analisado(s)")
            for d in sx.get("detalhes", []):
                linha(f"    · {d}")

        # Estatura
        if p["estatura"]:
            titulo("ESTATURA ESTIMADA  ·  CAP.3")
            st = p["estatura"]
            linha(f"  {st['est']} cm")
            linha(f"  Intervalo: {st['min']} – {st['max']} cm  (SEE ±{st['see']}cm)")
            linha(f"  Equação: Ht = {st['eq']}")
            linha(f"  Comp. plantar médio: {p['avg_fl']} cm")
            linha(f"  [Índice Topinard: FL ≈ 15% da estatura]")

        # Peso
        if p["peso"]:
            titulo("PESO ESTIMADO  ·  CAP.4")
            pe = p["peso"]
            linha(f"  {pe['est']} kg")
            linha(f"  Faixa: {pe['min']} – {pe['max']} kg")
            linha(f"  Método: {pe['metodo']}")
            linha(f"  {pe['nota_solo']}")
            if p.get("avg_depth"):
                linha(f"  Prof. média pegada: {p['avg_depth']} mm")

        # Velocidade
        if p["velocidade"]:
            titulo("VELOCIDADE / MARCHA  ·  CAP.2")
            vel = p["velocidade"]
            linha(f"  {vel['kmh']} km/h  ({vel['ms']} m/s)")
            linha(f"  Tipo: {vel['gait']}")
            linha(f"  Morfologia: {vel['nota']}")
            linha(f"  Passada média: {p['avg_sl']} cm")
            linha(f"  [V = SL × 117/2 / 60 · cadência ref. Cap.2]")
            linha(f"  Ref: ♂ 158cm/1,54m/s · ♀ 132cm/1,31m/s")
            linha(f"  Corrida: SL>200cm, calcanhar ausente, fase de voo")

        # Dados brutos
        titulo("DADOS DE ENTRADA (MÉDIAS)")
        for k, l in [("avg_fl","Comprimento plantar"),("avg_fw","Largura do pé"),
                     ("avg_sl","Passada"),("avg_depth","Profundidade")]:
            if p.get(k): linha(f"  {l}: {p[k]}")
        sep()

        self.analise_text.config(state="disabled")

    # ── ABA CONFIGURAÇÕES ─────────────────────────────────────────────────

    def _tab_config(self):
        f = self.tab_config
        self._panel(f, "DADOS DO RASTREADOR  ·  CALIBRAÇÃO CAP.4").pack(fill="x", padx=8, pady=8)

        cfg_f = tk.Frame(f, bg=PANEL, padx=10, pady=8)
        cfg_f.pack(fill="x", padx=8)
        campos_cfg = [
            ("peso_rastreador", "Meu peso (kg)", str(RASTREADOR_PESO_KG)),
            ("prof_rastreador", "Minha profundidade de pegada (mm)", str(RASTREADOR_PROF_MM)),
        ]
        self.cfg_entries = {}
        for key, lbl, dflt in campos_cfg:
            tk.Label(cfg_f, text=lbl, fg=DIM, bg=PANEL, font=FONTL).pack(anchor="w", pady=(4,0))
            e = tk.Entry(cfg_f, bg="#07100d", fg=GREEN, font=FONT,
                         insertbackground=GREEN, relief="flat")
            e.insert(0, str(self.cfg.get(key, dflt)))
            e.pack(fill="x", pady=(0,4))
            self.cfg_entries[key] = e

        tk.Button(cfg_f, text="✓  APLICAR CONFIGURAÇÕES", bg="#0f2a1a",
                  fg=GREEN, font=FONTB, relief="flat", command=self._aplicar_cfg, pady=8
                  ).pack(fill="x", pady=4)

        # Info de arquivos
        ip = self._panel(f, "ARQUIVOS DE DADOS")
        ip.pack(fill="x", padx=8, pady=4)
        for txt in [f"JSON: {ARQUIVO_JSON}", f"CSV:  {ARQUIVO_CSV}",
                    f"JSON local: {ARQUIVO_JSON_LOCAL}", f"CSV local:  {ARQUIVO_CSV_LOCAL}"]:
            tk.Label(ip, text=txt, fg=DIM, bg=PANEL, font=FONTL, anchor="w").pack(fill="x", padx=4)

        # Equações de referência
        rp = self._panel(f, "EQUAÇÕES DE REFERÊNCIA (Cap.3)")
        rp.pack(fill="x", padx=8, pady=4)
        for eq in ["♂ Dir: Ht = 86,89 + 3,49 × RFPL  (SEE ±7,2)",
                   "♂ Esq: Ht = 90,15 + 3,34 × LFPL  (SEE ±7,2)",
                   "♀ Dir: Ht = 58,93 + 4,42 × RFPL  (SEE ±8,7)",
                   "♀ Esq: Ht = 63,20 + 4,28 × LFPL  (SEE ±8,7)",
                   "Topinard: FL ≈ 15% da estatura total",
                   "Velocidade: V = SL × 58,5 / 60",
                   "Ref Cap.2: ♂ 1,54m/s · ♀ 1,31m/s"]:
            tk.Label(rp, text=eq, fg="#2a5a38", bg=PANEL, font=FONTL, anchor="w").pack(fill="x", padx=4)

    def _aplicar_cfg(self):
        for k, e in self.cfg_entries.items():
            try:
                self.cfg[k] = float(e.get().replace(",", "."))
            except Exception:
                pass
        messagebox.showinfo("RT-VH", "✓ Configurações aplicadas!")

    # ── HELPERS ───────────────────────────────────────────────────────────

    def _panel(self, parent, titulo):
        f = tk.Frame(parent, bg=PANEL, pady=4, padx=6, relief="flat")
        tk.Label(f, text=titulo, fg=DIM, bg=PANEL,
                 font=("Courier", 9, "bold")).pack(anchor="w")
        return f

    def _toggle_missao(self):
        if not self.missao_ativa:
            self.missao_ativa = True
            self.t_inicio = datetime.datetime.now()
            self.btn_missao.config(text="■  ENCERRAR MISSÃO", fg=RED, highlightbackground=RED)
            self.btn_nova_ev.config(state="normal")
            self._tick()
        else:
            self.missao_ativa = False
            self.btn_missao.config(text="▶  INICIAR MISSÃO", fg=GREEN, highlightbackground=GREEN)
            self.btn_nova_ev.config(state="disabled")
            self._salvar()

    def _tick(self):
        if self.missao_ativa and self.t_inicio:
            delta = datetime.datetime.now() - self.t_inicio
            h, rem = divmod(int(delta.total_seconds()), 3600)
            m, s   = divmod(rem, 60)
            self.lbl_tempo.config(text=f"{h:02d}:{m:02d}:{s:02d}")
            self.after(1000, self._tick)

    def _ir_pegada(self):
        self.nb.select(self.tab_pegada)

    def _atualizar_status(self):
        n = len(self.evidencias)
        np = len([e for e in self.evidencias if e.get("tipo") == "pegada"])
        self.lbl_nev.config(text=str(n))
        self.lbl_npeg.config(text=str(np))
        if self.missao_ativa:
            self.lbl_status.config(text="● ATIVO", fg=GREEN)
        else:
            self.lbl_status.config(text="○ AGUARDANDO", fg=DIM)

    def _salvar(self):
        dados = {
            "missao_id": MISSAO_ID, "operador": OPERADOR, "local": LOCAL,
            "salvo_em": datetime.datetime.now().isoformat(),
            "cfg": self.cfg, "evidencias": self.evidencias
        }
        caminho = salvar_json(dados)
        messagebox.showinfo("RT-VH", f"✓ Dados salvos!\n{caminho or ARQUIVO_JSON_LOCAL}")

    def _exportar_csv(self):
        caminho = exportar_csv(self.evidencias, ARQUIVO_CSV)
        messagebox.showinfo("RT-VH", f"✓ CSV exportado!\n{caminho or ARQUIVO_CSV_LOCAL}")

    def _limpar(self):
        if messagebox.askyesno("RT-VH", "Limpar TODAS as evidências?\nEsta ação não pode ser desfeita."):
            self.evidencias = []
            self._atualizar_status()
            self._atualizar_lista()


# Labels para mensagens
LABELS = {"pegada":"Pegada","vestigio":"Vestígio","dejeto":"Dejeto","galho":"Galho","sangue":"Sangue"}


# =============================================================================
#  PONTO DE ENTRADA
# =============================================================================

if __name__ == "__main__":
    app = RTVHApp()
    app.mainloop()

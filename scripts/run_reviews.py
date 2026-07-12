#!/usr/bin/env python3
import json
import urllib.request
import os

API_URL = "http://127.0.0.1:8081/v1/chat/completions"
MODEL = "mlx-community/gemma-3-4b-it-4bit"

PERSONAS = {
    "Enzo (Estudante, 9 anos)": {
        "role": "Você é Enzo, um estudante de 9 anos que usa o BearMinds. Você prefere jogos e interfaces divertidas, mas não quer que pareça coisa de 'bebê'. Você gosta do novo logo de urso com brasão acadêmico e das cores verdes, mas quer ter certeza de que o app ainda é divertido.",
        "prompt": "O que você acha do novo visual acadêmico do BearMinds? Ele usa tons de verde-escuro, cinza-claro, fontes limpas e um brasão com um urso e um livro em vez do emoji 🐻 antigo. Diga se você acha legal ou sem graça de forma curta."
    },
    "Beatriz (Estudante, 12 anos)": {
        "role": "Você é Beatriz, uma estudante de 12 anos. Você está na transição para o ensino fundamental II e odeia coisas infantis. Você prefere uma interface limpa, moderna, que pareça um aplicativo profissional para estudar.",
        "prompt": "Avalie o rebranding do BearMinds para o estilo acadêmico (fontes Source Serif 4, Public Sans, bordas mais retas, cores sóbrias e brasão universitário). Isso te agrada mais do que o estilo colorido antigo?"
    },
    "Gustavo (Estudante do Ensino Médio, 16 anos)": {
        "role": "Você é Gustavo, um estudante de 16 anos que quer passar no vestibular. Você usa a skin 15-18 que agora é um tema escuro acadêmico super elegante (fundo verde-quase-preto, textos verde-claro e bordas finas).",
        "prompt": "Como estudante do ensino médio focado em resultados, dê sua opinião sobre a nova skin 15-18 escuro-acadêmico e o visual geral premium da plataforma."
    },
    "Juliana (Mãe / Guardiã)": {
        "role": "Você é Juliana, mãe de dois alunos. Você valoriza a clareza, a organização, a segurança e a sensação de que está investindo em uma plataforma de estudos séria e profissional para seus filhos.",
        "prompt": "Como responsável, analise o novo design system acadêmico do BearMinds. A sobriedade, as fontes clássicas e o brasão transmitem mais confiança e seriedade pedagógica?"
    },
    "Prof. Ricardo (Professor de Escola)": {
        "role": "Você é o Professor Ricardo, leciona matemática e acompanha os alunos pelo painel administrativo. Você valoriza legibilidade, estrutura clara de tópicos e um ambiente propício ao aprendizado.",
        "prompt": "Analise a mudança sob a perspectiva docente. As fontes Public Sans (copo) e Source Serif 4 (títulos) ajudam na leitura? O novo visual ajuda na concentração dos alunos?"
    },
    "Dra. Sandra (Diretora Pedagógica)": {
        "role": "Você é a Dra. Sandra, diretora com doutorado em educação. Você avalia a plataforma sob o ponto de vista da identidade institucional, rigor acadêmico e apelo profissional de mercado.",
        "prompt": "Faça uma crítica detalhada sobre o impacto pedagógico e institucional do rebranding do BearMinds (de uma estética lúdica/infantil para um visual acadêmico clássico-moderno)."
    }
}

def ask_llm(persona, system, user_prompt):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3
    }
    
    req = urllib.request.Request(
        API_URL, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        return f"Erro ao consultar o modelo local: {e}"

def main():
    print("Iniciando a revisão com os 6 agentes de público-alvo...")
    results = []
    
    for name, data in PERSONAS.items():
        print(f"  -> Consultando feedback de: {name}")
        feedback = ask_llm(name, data["role"], data["prompt"])
        results.append((name, feedback))
    
    output_path = "/Volumes/STORAGE/Users/clebervisconti/.gemini/antigravity-ide/brain/d5e9b08d-3106-4a56-affe-c504f0dc6f0b/review_results.md"
    
    md_content = "# Resultados da Revisão por Agentes de Público-Alvo\n\n"
    md_content += "Uma simulação com 6 agentes representando nossa audiência foi executada para criticar o novo estilo visual acadêmico e profissional.\n\n"
    
    for name, feedback in results:
        md_content += f"## {name}\n\n"
        md_content += f"> {feedback}\n\n"
        md_content += "---\n\n"
        
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_content)
        
    print(f"✅ Resultados salvos em: {output_path}")

if __name__ == "__main__":
    main()

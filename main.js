import { Store } from './store.js';
import { formatCurrency, formatDate, parseNumber } from './utils.js';

class App {
    constructor() {
        this.store = new Store();
        this.bindEvents();
        this.render();
        // Setup initial cartao if needed
        if (this.store.data.cartao.faturaInicial === 0 && this.store.data.cartao.vencimento === '') {
            // For first boot, gently ask for initial fatura if possible, or leave as 0
            console.log("Welcome to FinDash!");
        }
    }

    bindEvents() {
    window.app = this;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // ativa botão
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // pega qual view abrir
            const view = item.getAttribute('data-view');

            // esconde todas
            document.querySelectorAll('.view-section').forEach(section => {
                section.style.display = 'none';
            });

            // mostra a selecionada
            const target = document.getElementById(`view-${view}`);
            if (target) {
                target.style.display = 'block';
            }

            // atualiza título
            const title = item.textContent.trim();
            document.getElementById('page-title').textContent = title;
        });
    });

    // fechar modal
    document.getElementById('modal-container').addEventListener('click', (e) => {
        if (e.target.id === 'modal-container') {
            this.closeModal();
        }
    });
}

    openModal(type) {
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        let html = '';

        if (type === 'receita') {
            modalTitle.textContent = 'Nova Receita';
            html = `
                <form id="form-receita" onsubmit="window.app.handleFormSubmit(event, 'receita')">
                    <div class="form-group">
                        <label>Nome / Descrição</label>
                        <input type="text" class="form-control" name="descricao" required>
                    </div>
                    <div class="form-group">
                        <label>Valor (R$)</label>
                        <input type="number" step="0.01" class="form-control" name="valor" required>
                    </div>
                    <div class="form-group">
                        <label>Data</label>
                        <input type="date" class="form-control" name="data" required>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-control" name="status">
                            <option value="Recebido">Recebido</option>
                            <option value="Previsto">Previsto</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Receita</button>
                    </div>
                </form>
            `;
        } else if (type === 'despesa-fixa') {
            modalTitle.textContent = 'Nova Despesa Fixa';
            html = `
                <form id="form-despesa-fixa" onsubmit="window.app.handleFormSubmit(event, 'despesa-fixa')">
                    <div class="form-group">
                        <label>Nome</label>
                        <input type="text" class="form-control" name="nome" required>
                    </div>
                    <div class="form-group">
                        <label>Valor (R$)</label>
                        <input type="number" step="0.01" class="form-control" name="valor" required>
                    </div>
                    <div class="form-group">
                        <label>Data de Cobrança (Ex: 15)</label>
                        <input type="number" min="1" max="31" class="form-control" name="dia" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar</button>
                    </div>
                </form>
            `;
        } else if (type === 'despesa-variavel') {
            modalTitle.textContent = 'Nova Despesa Variável';
            html = `
                <form id="form-despesa-variavel" onsubmit="window.app.handleFormSubmit(event, 'despesa-variavel')">
                    <div class="form-group">
                        <label>Categoria/Descrição</label>
                        <input type="text" class="form-control" name="categoria" required>
                    </div>
                    <div class="form-group">
                        <label>Valor (R$)</label>
                        <input type="number" step="0.01" class="form-control" name="valor" required>
                    </div>
                    <div class="form-group">
                        <label>Data</label>
                        <input type="date" class="form-control" name="data" required>
                    </div>
                    <!-- Always Débito here since credit goes to fatura -->
                    <input type="hidden" name="tipoPagamento" value="Débito">
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar</button>
                    </div>
                </form>
            `;
        } else if (type === 'compra-cartao') {
            modalTitle.textContent = 'Nova Compra no Cartão';
            html = `
                <form id="form-compra-cartao" onsubmit="window.app.handleFormSubmit(event, 'compra-cartao')">
                    <div class="form-group">
                        <label>Descrição</label>
                        <input type="text" class="form-control" name="descricao" required>
                    </div>
                    <div class="form-group">
                        <label>Valor Total (R$)</label>
                        <input type="number" step="0.01" class="form-control" name="valor" required>
                    </div>
                    <div class="form-group">
                        <label>Data da Compra</label>
                        <input type="date" class="form-control" name="data" required>
                    </div>
                    <div class="form-group">
                        <label>Parcelas (1 para à vista)</label>
                        <input type="number" min="1" max="48" value="1" class="form-control" name="parcelas" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Compra</button>
                    </div>
                </form>
            `;
        } else if (type === 'investimento') {
            modalTitle.textContent = 'Novo Investimento';
            html = `
                <form id="form-investimento" onsubmit="window.app.handleFormSubmit(event, 'investimento')">
                    <div class="form-group">
                        <label>Tipo (Ex: CDB, Ações...)</label>
                        <input type="text" class="form-control" name="tipo" required>
                    </div>
                    <div class="form-group">
                        <label>Valor (R$)</label>
                        <input type="number" step="0.01" class="form-control" name="valor" required>
                    </div>
                    <div class="form-group">
                        <label>Data</label>
                        <input type="date" class="form-control" name="data" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar</button>
                    </div>
                </form>
            `;
        } else if (type === 'config-cartao') {
            modalTitle.textContent = 'Fatura Inicial';
            html = `
                <form id="form-config-cartao" onsubmit="window.app.handleFormSubmit(event, 'config-cartao')">
                    <div class="form-group">
                        <label>Valor da Fatura Inicial (R$)</label>
                        <input type="number" step="0.01" class="form-control" name="valor" value="${this.store.data.cartao.faturaInicial}" required>
                    </div>
                    <div class="form-group">
                        <label>Dia do Vencimento</label>
                        <input type="number" min="1" max="31" class="form-control" name="vencimento" value="${this.store.data.cartao.vencimento}" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Configuração</button>
                    </div>
                </form>
            `;
        }

        modalBody.innerHTML = html;
        document.getElementById('modal-container').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal-container').classList.remove('active');
    }

    handleFormSubmit(e, type) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        if (type === 'receita') {
            this.store.addReceita({
                descricao: formData.get('descricao'),
                valor: parseNumber(formData.get('valor')),
                data: formData.get('data'),
                status: formData.get('status')
            });
        } else if (type === 'despesa-fixa') {
            this.store.addDespesaFixa({
                nome: formData.get('nome'),
                valor: parseNumber(formData.get('valor')),
                dia: formData.get('dia')
            });
        } else if (type === 'despesa-variavel') {
            this.store.addDespesaVariavel({
                categoria: formData.get('categoria'),
                valor: parseNumber(formData.get('valor')),
                data: formData.get('data'),
                tipoPagamento: formData.get('tipoPagamento')
            });
        } else if (type === 'compra-cartao') {
            const parcelas = parseInt(formData.get('parcelas'), 10);
            this.store.addCompraCartao({
                descricao: formData.get('descricao'),
                valor: parseNumber(formData.get('valor')),
                data: formData.get('data'),
                parcelado: parcelas > 1,
                parcelas: parcelas
            });
        } else if (type === 'investimento') {
            this.store.addInvestimento({
                tipo: formData.get('tipo'),
                valor: parseNumber(formData.get('valor')),
                data: formData.get('data')
            });
        } else if (type === 'config-cartao') {
            this.store.setFaturaInicial(
                parseNumber(formData.get('valor')),
                formData.get('vencimento')
            );
        }

        this.closeModal();
        this.render();
    }

    deleteItem(type, id) {
        if(confirm('Tem certeza que deseja excluir?')) {
            this.store.deleteItem(type, id);
            this.render();
        }
    }

    render() {
        // 1. Update Metrics
        const sDisponivel = this.store.getSaldoDisponivelHoje();
        const sProjetado = this.store.getSaldoProjetado();
        const sComprometido = this.store.getSaldoComprometido();
        const lDiario = this.store.getLimiteDiario();
        
        document.getElementById('saldo-disponivel').textContent = formatCurrency(sDisponivel);
        document.getElementById('saldo-projetado').textContent = formatCurrency(sProjetado);
        document.getElementById('saldo-comprometido').textContent = formatCurrency(sComprometido);
        document.getElementById('limite-diario').textContent = formatCurrency(lDiario);

        // Update colors based on health
        const sDispEl = document.getElementById('saldo-disponivel').parentElement;
        if (sDisponivel < 0) {
            sDispEl.className = 'metric-card glass-panel danger-card';
        } else if (sDisponivel < 200) {
            sDispEl.className = 'metric-card glass-panel info-card'; // could be warning
        } else {
            sDispEl.className = 'metric-card glass-panel primary-card';
        }

        // 2. Fatura Atual
        const faturaEl = document.getElementById('fatura-atual');
        faturaEl.textContent = formatCurrency(this.store.getFaturaAtualValue());
        faturaEl.style.cursor = 'pointer';
        faturaEl.title = "Clique para configurar valor base";
        faturaEl.onclick = () => this.openModal('config-cartao');

        const listaFatura = document.getElementById('lista-fatura-atual');
        listaFatura.innerHTML = this.store.data.cartao.compras.slice(-5).map(c => `
            <li class="list-item">
                <div class="item-info">
                    <h4>${c.descricao} ${c.parcelado ? `(1/${c.parcelas})` : ''}</h4>
                    <p>${formatDate(c.data)}</p>
                </div>
                <div class="item-amount text-danger">
                    ${formatCurrency(c.parcelado ? c.valor/c.parcelas : c.valor)}
                </div>
                <button class="close-btn" style="font-size:1rem" onclick="window.app.deleteItem('compra-cartao', '${c.id}')">&times;</button>
            </li>
        `).join('');

        // 3. Receitas
        document.getElementById('lista-receitas').innerHTML = this.store.data.receitas.map(r => `
            <li class="list-item">
                <div class="item-info">
                    <h4>${r.descricao} - <em>${r.status}</em></h4>
                    <p>${formatDate(r.data)}</p>
                </div>
                <div class="item-amount text-success">+${formatCurrency(r.valor)}</div>
                <button class="close-btn" style="font-size:1rem" onclick="window.app.deleteItem('receita', '${r.id}')">&times;</button>
            </li>
        `).join('');

        // 4. Despesas (Mix Fixas + Variáveis for display)
        const allDespesas = [
            ...this.store.data.despesasFixas.map(d => ({...d, isFixa: true, desc: d.nome})),
            ...this.store.data.despesasVariaveis.map(d => ({...d, isFixa: false, desc: d.categoria}))
        ];
        
        document.getElementById('lista-despesas').innerHTML = allDespesas.map(d => `
            <li class="list-item">
                <div class="item-info">
                    <h4>${d.desc} ${d.isFixa ? '<span style="font-size:10px;background:var(--primary);padding:2px 6px;border-radius:10px;color:white;margin-left:5px">FIXA</span>' : ''}</h4>
                    <p>${d.isFixa ? 'Todo dia ' + d.dia : formatDate(d.data)}</p>
                </div>
                <div class="item-amount text-danger">-${formatCurrency(d.valor)}</div>
                <button class="close-btn" style="font-size:1rem" onclick="window.app.deleteItem('${d.isFixa?'despesa-fixa':'despesa-variavel'}', '${d.id}')">&times;</button>
            </li>
        `).join('');

        // 5. Investimentos
        const tInvestimentos = this.store.data.investimentos.reduce((a, b) => a + b.valor, 0);
        document.getElementById('total-investido').textContent = formatCurrency(tInvestimentos);
        document.getElementById('lista-investimentos').innerHTML = this.store.data.investimentos.map(i => `
            <li class="list-item">
                <div class="item-info">
                    <h4>${i.tipo}</h4>
                    <p>${formatDate(i.data)}</p>
                </div>
                <div class="item-amount text-success">${formatCurrency(i.valor)}</div>
                <button class="close-btn" style="font-size:1rem" onclick="window.app.deleteItem('investimento', '${i.id}')">&times;</button>
            </li>
        `).join('');
    }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

import { generateId, isPastOrToday, isThisMonth, getDaysLeftInMonth } from './utils.js';

export class Store {
    constructor() {
        this.STORAGE_KEY = 'findash_data';
        this.data = this.loadData();
    }

    loadData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            receitas: [],
            despesasFixas: [],
            despesasVariaveis: [],
            cartao: {
                faturaInicial: 0,
                vencimento: '',
                compras: []
            },
            investimentos: []
        };
    }

    saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    // --- CRUD Receitas ---
    addReceita(receita) {
        this.data.receitas.push({ ...receita, id: generateId() });
        this.saveData();
    }

    // --- CRUD Despesas Fixas ---
    addDespesaFixa(despesa) {
        this.data.despesasFixas.push({ ...despesa, id: generateId() });
        this.saveData();
    }

    // --- CRUD Despesas Variáveis ---
    addDespesaVariavel(despesa) {
        this.data.despesasVariaveis.push({ ...despesa, id: generateId() });
        this.saveData();
    }

    // --- Cartão de Crédito ---
    setFaturaInicial(valor, vencimento) {
        this.data.cartao.faturaInicial = valor;
        this.data.cartao.vencimento = vencimento;
        this.saveData();
    }

    addCompraCartao(compra) {
        this.data.cartao.compras.push({ ...compra, id: generateId() });
        this.saveData();
    }

    // --- Investimentos ---
    addInvestimento(investimento) {
        this.data.investimentos.push({ ...investimento, id: generateId() });
        this.saveData();
    }
    
    // --- Deletions ---
    deleteItem(type, id) {
        if (type === 'receita') {
            this.data.receitas = this.data.receitas.filter(i => i.id !== id);
        } else if (type === 'despesa-fixa') {
            this.data.despesasFixas = this.data.despesasFixas.filter(i => i.id !== id);
        } else if (type === 'despesa-variavel') {
            this.data.despesasVariaveis = this.data.despesasVariaveis.filter(i => i.id !== id);
        } else if (type === 'compra-cartao') {
            this.data.cartao.compras = this.data.cartao.compras.filter(i => i.id !== id);
        } else if (type === 'investimento') {
            this.data.investimentos = this.data.investimentos.filter(i => i.id !== id);
        }
        this.saveData();
    }

    // --- CALCULATORS ---

    getFaturaAtualValue() {
        let total = this.data.cartao.faturaInicial || 0;
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0,0,0,0);
        
        this.data.cartao.compras.forEach(c => {
            const purchaseDate = new Date(c.data + 'T00:00:00');
            const dataMonthStart = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
            
            // Diferença em meses entre hoje e a data da compra
            const diffMonths = (currentMonthStart.getFullYear() - dataMonthStart.getFullYear()) * 12 + 
                               (currentMonthStart.getMonth() - dataMonthStart.getMonth());

            if (c.parcelado) {
                // A parcela cai neste mês se a diferença de meses for >= 0 e menor que o total de parcelas
                if (diffMonths >= 0 && diffMonths < c.parcelas) {
                    total += (c.valor / c.parcelas);
                }
            } else {
                // Compra à vista entra se for do mês atual
                if (diffMonths === 0) {
                    total += c.valor;
                }
            }
        });
        
        return total;
    }
    
    getFaturaTotalFutura() {
        let total = this.data.cartao.faturaInicial || 0;
        this.data.cartao.compras.forEach(c => {
            total += c.valor; // For future projections, the entire debt matters
        });
        return total;
    }

    getSaldoDisponivelHoje() {
        // 1. Receitas (Recebido OR date <= today)
        let totalReceitas = 0;
        this.data.receitas.forEach(r => {
            if (r.status === 'Recebido' || isPastOrToday(r.data)) {
                totalReceitas += r.valor;
            }
        });

        // 2. Despesas fixas (do mês)
        let totalFixas = 0;
        this.data.despesasFixas.forEach(d => {
            // Fixas represent monthly obligations, so we just subtract their value
            totalFixas += d.valor;
        });

        // 3. Fatura atual
        const fatura = this.getFaturaAtualValue();

        // 4. Despesas variáveis (Débito, este mês)
        let totalVariaveis = 0;
        this.data.despesasVariaveis.forEach(d => {
            if (d.tipoPagamento === 'Débito' && isThisMonth(d.data)) {
                totalVariaveis += d.valor;
            }
        });

        // 5. Investimentos
        let totalInvestimentos = 0;
        this.data.investimentos.forEach(i => {
            totalInvestimentos += i.valor;
        });

        return totalReceitas - totalFixas - fatura - totalVariaveis - totalInvestimentos;
    }

    getSaldoProjetado() {
        // Todas as receitas
        const receitas = this.data.receitas.reduce((acc, r) => acc + r.valor, 0);
        // Despesas fixas (assumed across a specific projection window, let's keep it simple: sum of registered)
        // Wait, the rule says "todas as despesas fixas futuras".
        const fixas = this.data.despesasFixas.reduce((acc, r) => acc + r.valor, 0);
        // Faturas (todas)
        const faturas = this.getFaturaTotalFutura();
        // Investimentos (todos)
        const investimentos = this.data.investimentos.reduce((acc, r) => acc + r.valor, 0);
        
        // Let's also deduct all Variable Expenses already registered
        const variaveis = this.data.despesasVariaveis.reduce((acc, r) => acc + (r.tipoPagamento === 'Débito' ? r.valor : 0), 0);

        return receitas - fixas - faturas - investimentos - variaveis;
    }

    getSaldoComprometido() {
        // Dinheiro disponível atualmente = Receitas (recebidas) - Despesas (já pagas em débito) - Investimentos (já feitos)
        let dinheiroAtual = 0;
        this.data.receitas.forEach(r => {
            if (r.status === 'Recebido' || isPastOrToday(r.data)) {
                dinheiroAtual += r.valor;
            }
        });
        
        let despesasPagas = 0;
        this.data.despesasVariaveis.forEach(d => {
            if (d.tipoPagamento === 'Débito' && isPastOrToday(d.data)) {
                despesasPagas += d.valor;
            }
        });
        
        let investimentos = this.data.investimentos.reduce((acc, r) => acc + r.valor, 0);
        
        let dinheiroLivre = dinheiroAtual - despesasPagas - investimentos;
        
        // Dividas futuras = Total faturas + total despesas fixas
        let dividas = this.getFaturaTotalFutura();
        let fixas = this.data.despesasFixas.reduce((acc, r) => acc + r.valor, 0); // we assume 1x cycle for now
        
        let totalDividas = dividas + fixas;
        
        return totalDividas - dinheiroLivre;
    }

    getLimiteDiario() {
        const saldo = this.getSaldoDisponivelHoje();
        if (saldo <= 0) return 0;
        return saldo / getDaysLeftInMonth();
    }
}

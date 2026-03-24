export const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const parseNumber = (valueString) => {
    if (!valueString) return 0;
    // Replace comma with dot if user typed it
    const normalized = valueString.replace(',', '.');
    return parseFloat(normalized) || 0;
};

export const isPastOrToday = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString + 'T00:00:00');
    return date <= today;
};

export const isThisMonth = (dateString) => {
    const today = new Date();
    const date = new Date(dateString + 'T00:00:00');
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

export const isFuture = (dateString) => {
    return !isPastOrToday(dateString);
};

export const getDaysLeftInMonth = () => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const diffTime = Math.abs(lastDay - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
};

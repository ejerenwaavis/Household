import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';

export default function ExpenseForm({ householdId, onCreated }){
  const { t } = useLanguage();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const categories = ['Food', 'Groceries', 'Gas', 'Entertainment', 'Dining', 'Shopping', 'Utilities', 'Transportation', 'Medical', 'Other'];

  // Fetch household members on mount and get current user's role
  useEffect(() => {
    const fetchMembers = async () => {
      if (!householdId) return;
      try {
        const res = await api.get(`/households/${householdId}`);
        const memberList = res.data?.members || [];
        setMembers(memberList);
        
        // Find current user's role in this household
        const currentUserMember = memberList.find(m => m.userId === user?.id || m.email === user?.email);
        if (currentUserMember) {
          setUserRole(currentUserMember.role);
          // Non-managers can only add expenses for themselves
          if (!['owner', 'manager'].includes(currentUserMember.role)) {
            setContributorName(currentUserMember.name);
          } else if (memberList.length > 0 && !contributorName) {
            setContributorName(memberList[0].name);
          }
        }
      } catch (err) {
        console.error('[ExpenseForm] fetch members error:', err);
      }
    };
    fetchMembers();
  }, [householdId, user]);

  const reset = () => { 
    setAmount(''); 
    setCategory('Food'); 
    setDescription(''); 
    setError(null); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!householdId) return setError(t('No household selected', 'Sin hogar seleccionado'));
    if (!amount || Number(amount) <= 0) return setError(t('Enter a valid amount', 'Ingresa un monto válido'));
    if (!contributorName) return setError(t('Please select a household member', 'Por favor selecciona un miembro del hogar'));
    if (!description || description.trim() === '') return setError(t('Description is required', 'La descripción es requerida'));

    setLoading(true);
    try {
      const payload = { 
        amount: Number(amount), 
        category, 
        description,
        contributorName
      };

      console.log('[ExpenseForm] submitting payload:', payload, 'householdId:', householdId);

      const res = await api.post(`/expenses/${householdId}`, payload);
      console.log('[ExpenseForm] response:', res && res.data);

      const created = res.data.expense || { id: res.data.id, ...payload };
      if (onCreated) onCreated(created);
      reset();
    } catch (err) {
      console.error('[ExpenseForm] submit error:', err, err?.response?.data);
      setError(err?.response?.data?.error || t('Failed to create expense', 'Error al crear gasto'));
    } finally { setLoading(false); }
  };

  const isManagerOrOwner = ['owner', 'co-owner', 'manager'].includes(userRole);

  return (
    <>
      {!isManagerOrOwner && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            ℹ️ {t('You can only add expenses for yourself', 'Solo puedes agregar gastos para ti mismo')}. 
            {t('Managers and owners can add expenses for other members.', 'Los gerentes y propietarios pueden agregar gastos para otros miembros.')}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500">{t('Member', 'Miembro')}</label>
            {isManagerOrOwner ? (
              <select 
                value={contributorName} 
                onChange={(e)=>setContributorName(e.target.value)} 
                className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">-- {t('Select', 'Seleccionar')} --</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                value={contributorName} 
                disabled 
                className="mt-1 w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 cursor-not-allowed"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Amount', 'Monto')}</label>
            <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" type="number" step="0.01" className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Category', 'Categoría')}</label>
            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
              {categories.map((c) => (
                <option key={c} value={c}>{t(c, c === 'Food' ? 'Comida' : c === 'Groceries' ? 'Compras' : c === 'Gas' ? 'Gasolina' : c === 'Entertainment' ? 'Entretenimiento' : c === 'Dining' ? 'Restaurantes' : c === 'Shopping' ? 'Compras' : c === 'Utilities' ? 'Servicios' : c === 'Transportation' ? 'Transporte' : c === 'Medical' ? 'Médico' : 'Otro')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Description', 'Descripción')}</label>
            <input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder={t('e.g., Whole Foods, Target, Shell', 'p.ej., Whole Foods, Target, Shell')} className="mt-1 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>

          <div className="flex items-end">
            <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors">
              {loading ? t('Saving...', 'Guardando...') : t('Add Expense', 'Agregar Gasto')}
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
      </form>
    </>
  );
}

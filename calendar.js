// calendar.js

// Função auxiliar para obter o primeiro dia do mês
const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Função auxiliar para obter o último dia do mês
const getLastDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

// Função principal para renderizar o calendário
function renderCalendar(containerId, initialDate, onDateSelect, agendamentos) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let currentDate = initialDate || new Date();
  let selectedDate = currentDate.toISOString().slice(0, 10);

  // Mapeia agendamentos para fácil acesso (data -> status)
  const agendamentosMap = (agendamentos || []).reduce((acc, item) => {
    acc[item.data] = item.status;
    return acc;
  }, {});

  // Função para desenhar o calendário
  const drawCalendar = () => {
    container.innerHTML = ''; // Limpa o conteúdo anterior

    const monthYearStr = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const firstDay = getFirstDayOfMonth(currentDate);
    const lastDay = getLastDayOfMonth(currentDate);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Domingo, 6 = Sábado

    // 1. Cabeçalho (Navegação)
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
      <button class="calendar-nav-btn" data-action="prev"><</button>
      <h3 class="calendar-title">${monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1)}</h3>
      <button class="calendar-nav-btn" data-action="next">></button>
    `;
    container.appendChild(header);

    // 2. Dias da Semana
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekDaysRow = document.createElement('div');
    weekDaysRow.className = 'calendar-weekdays';
    weekDaysRow.innerHTML = weekDays.map(day => `<span>${day}</span>`).join('');
    container.appendChild(weekDaysRow);

    // 3. Grid de Dias
    const daysGrid = document.createElement('div');
    daysGrid.className = 'calendar-grid';

    // Preenche os dias vazios do mês anterior
    let dayCounter = 0;
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevMonthDay = new Date(firstDay);
      prevMonthDay.setDate(firstDay.getDate() - (startDayOfWeek - i));
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day empty';
      dayEl.textContent = prevMonthDay.getDate();
      daysGrid.appendChild(dayEl);
      dayCounter++;
    }

    // Preenche os dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateISO = date.toISOString().slice(0, 10);
      const isToday = dateISO === new Date().toISOString().slice(0, 10);
      const isSelected = dateISO === selectedDate;
      const status = agendamentosMap[dateISO];

      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = day;
      dayEl.dataset.date = dateISO;

      if (isToday) dayEl.classList.add('today');
      if (isSelected) dayEl.classList.add('selected');
      if (status) dayEl.classList.add(`status-${status}`);

      // Evento de clique para selecionar a data
      dayEl.onclick = () => {
        selectedDate = dateISO;
        onDateSelect(dateISO);
        drawCalendar(); // Redesenha para atualizar a seleção
      };

      daysGrid.appendChild(dayEl);
      dayCounter++;
    }

    // Preenche os dias vazios do próximo mês
    const totalCells = 42; // 6 semanas * 7 dias
    for (let i = 1; dayCounter < totalCells; i++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day empty';
      dayEl.textContent = i;
      daysGrid.appendChild(dayEl);
      dayCounter++;
    }

    container.appendChild(daysGrid);

    // Adiciona listeners de navegação
    container.querySelector('[data-action="prev"]').onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      drawCalendar();
    };
    container.querySelector('[data-action="next"]').onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      drawCalendar();
    };
  };

  // Inicializa o desenho
  drawCalendar();
}

// Exporta a função para uso em app.js
window.renderCalendar = renderCalendar;

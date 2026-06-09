(function () {
  window.OpsRadarFrontend?.registerModule('calendar', {
    file: 'js/calendar.js',
    screen: 'calendar',
    owns: [
      'calendar month state',
      'calendar grid rendering',
      'calendar event modal',
      'natural-language schedule registration hooks',
    ],
    legacyGlobals: [
      'renderCalendar',
      'goToPrevMonth',
      'goToNextMonth',
      'openCalModal',
      'addCalTag',
      'deleteCalTag',
      'registerCalEvent',
      'miniChat',
      'toggleColorPicker',
      'pickColor',
    ],
  });
})();

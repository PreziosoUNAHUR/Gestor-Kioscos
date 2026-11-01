const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'node_modules/**', '.tmp-sqltest/**'],
  },
  {
    rules: {
      /**
       * Los formularios en modales y las suscripciones de Realtime sincronizan
       * estado al abrirse/enablearse. Es el patrón que usa la app para reiniciar
       * el formulario y reflejar "conectando"; no provoca renders en cascada
       * porque ocurre una sola vez por cambio de `visible`/`enabled`.
       */
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);

/* Bloque Gutenberg "BeZhas Pay" — botón de cobro embebible. */
(function (blocks, element, blockEditor, components) {
  var el = element.createElement;
  var InspectorControls = blockEditor.InspectorControls;
  var TextControl = components.TextControl;
  var PanelBody = components.PanelBody;

  blocks.registerBlockType('bezhas/pay', {
    title: 'BeZhas Pay',
    icon: 'money-alt',
    category: 'widgets',
    attributes: {
      amount: { type: 'string', default: '0' },
      currency: { type: 'string', default: 'EUR' },
      label: { type: 'string', default: 'Pagar con BeZhas-Pay' },
    },
    edit: function (props) {
      var a = props.attributes;
      return el('div', {},
        el(InspectorControls, {},
          el(PanelBody, { title: 'BeZhas Pay', initialOpen: true },
            el(TextControl, { label: 'Importe', value: a.amount, onChange: function (v) { props.setAttributes({ amount: v }); } }),
            el(TextControl, { label: 'Moneda', value: a.currency, onChange: function (v) { props.setAttributes({ currency: v }); } }),
            el(TextControl, { label: 'Texto del botón', value: a.label, onChange: function (v) { props.setAttributes({ label: v }); } })
          )
        ),
        el('button', { className: 'bezhas-pay-btn', disabled: true }, a.label + ' (' + a.amount + ' ' + a.currency + ')')
      );
    },
    save: function () { return null; }, // render dinámico en PHP (render_callback)
  });
})(window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components);

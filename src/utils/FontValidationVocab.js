// Single source of truth for the CSS font-style and font-weight literal
// vocabularies that the validators in FontPropertiesFAB and FontSetGenerator
// accept. Pure browser-style global (no module exports); HTML pages source
// this file ahead of the consumers.

const FontValidationVocab = {
  STYLES: ['normal', 'italic', 'oblique'],
  WEIGHTS: ['normal', 'bold', 'bolder', 'lighter',
            '100', '200', '300', '400', '500', '600', '700', '800', '900'],
};

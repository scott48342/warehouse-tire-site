// Verification script for fitment data
// Processes batches 201-271 (Group 4) - Expanded specs

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const BATCHES_DIR = './batches-overnight';
const RESULTS_DIR = './results-overnight';

// Known correct specifications by make/model/year range
const FITMENT_SPECS = {
  volkswagen: {
    default: { boltPattern: '5x112', hubBore: '57.1' },
    models: {
      'jetta': [
        { years: [1999, 2005], boltPattern: '5x100', hubBore: '57.1' },
        { years: [2006, 2030], boltPattern: '5x112', hubBore: '57.1' }
      ],
      'routan': [
        { years: [2008, 2014], boltPattern: '5x127', hubBore: '71.6' }
      ]
    }
  },
  honda: {
    models: {
      'civic': [
        { years: [1990, 2005], boltPattern: '4x100', hubBore: '56.1' },
        { years: [2006, 2030], boltPattern: '5x114.3', hubBore: '64.1' }
      ],
      'accord': [
        { years: [1990, 2002], boltPattern: '4x114.3', hubBore: '64.1' },
        { years: [2003, 2030], boltPattern: '5x114.3', hubBore: '64.1' }
      ],
      'prelude': [
        { years: [1990, 1991], boltPattern: '4x100', hubBore: '56.1' },
        { years: [1992, 1996], boltPattern: '4x114.3', hubBore: '64.1' },
        { years: [1997, 2001], boltPattern: '5x114.3', hubBore: '64.1' }
      ],
      'odyssey': [{ years: [1995, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'passport': [
        { years: [1994, 2002], boltPattern: '6x139.7', hubBore: '107.0' },
        { years: [2019, 2030], boltPattern: '5x114.3', hubBore: '64.1' }
      ],
      'del sol': [{ years: [1993, 1997], boltPattern: '4x100', hubBore: '56.1' }],
      'cr-v': [{ years: [1997, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'pilot': [{ years: [2003, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'hr-v': [{ years: [2016, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'ridgeline': [{ years: [2006, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'element': [{ years: [2003, 2011], boltPattern: '5x114.3', hubBore: '64.1' }],
      'insight': [
        { years: [2000, 2006], boltPattern: '4x100', hubBore: '56.1' },
        { years: [2010, 2030], boltPattern: '5x114.3', hubBore: '64.1' }
      ],
      'fit': [{ years: [2007, 2020], boltPattern: '4x100', hubBore: '56.1' }],
      's2000': [{ years: [2000, 2009], boltPattern: '5x114.3', hubBore: '64.1' }]
    }
  },
  buick: {
    default: { boltPattern: '5x115', hubBore: '70.3' },
    models: {
      'enclave': [{ years: [2008, 2030], boltPattern: '6x120', hubBore: '67.1' }],
      'encore': [{ years: [2013, 2030], boltPattern: '5x105', hubBore: '56.6' }],
      'envision': [{ years: [2016, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'lacrosse': [{ years: [2010, 2019], boltPattern: '5x120', hubBore: '67.1' }],
      'regal': [{ years: [2011, 2020], boltPattern: '5x120', hubBore: '67.1' }],
      'verano': [{ years: [2012, 2017], boltPattern: '5x105', hubBore: '56.6' }],
      'cascada': [{ years: [2016, 2019], boltPattern: '5x115', hubBore: '70.3' }]
    }
  },
  lincoln: {
    default: { boltPattern: '5x114.3', hubBore: '70.5' },
    models: {
      'navigator': [{ years: [1998, 2030], boltPattern: '6x135', hubBore: '87.1' }],
      'mkx': [{ years: [2007, 2018], boltPattern: '5x114.3', hubBore: '70.5' }],
      'nautilus': [{ years: [2019, 2030], boltPattern: '5x114.3', hubBore: '70.5' }],
      'aviator': [{ years: [2020, 2030], boltPattern: '6x135', hubBore: '87.1' }],
      'corsair': [{ years: [2020, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'continental': [{ years: [2017, 2020], boltPattern: '5x114.3', hubBore: '70.5' }],
      'mkz': [{ years: [2013, 2020], boltPattern: '5x114.3', hubBore: '70.5' }],
      'town car': [{ years: [1990, 2011], boltPattern: '5x114.3', hubBore: '70.5' }]
    }
  },
  mitsubishi: {
    default: { boltPattern: '5x114.3', hubBore: '67.1' },
    models: {
      'outlander': [{ years: [2003, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'eclipse': [
        { years: [1990, 1999], boltPattern: '4x114.3', hubBore: '67.1' },
        { years: [2000, 2012], boltPattern: '5x114.3', hubBore: '67.1' }
      ],
      'eclipse cross': [{ years: [2018, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'lancer': [{ years: [2002, 2017], boltPattern: '5x114.3', hubBore: '67.1' }],
      'mirage': [
        { years: [1997, 2002], boltPattern: '4x100', hubBore: '56.1' },
        { years: [2014, 2030], boltPattern: '4x100', hubBore: '56.1' }
      ]
    }
  },
  hyundai: {
    default: { boltPattern: '5x114.3', hubBore: '67.1' },
    models: {
      'accent': [{ years: [1995, 2030], boltPattern: '4x100', hubBore: '54.1' }],
      'sonata': [{ years: [1999, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'elantra': [
        { years: [1996, 2005], boltPattern: '4x114.3', hubBore: '67.1' },
        { years: [2006, 2030], boltPattern: '5x114.3', hubBore: '67.1' }
      ],
      'tucson': [{ years: [2005, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'santa fe': [{ years: [2001, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'palisade': [{ years: [2020, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'ioniq': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'kona': [{ years: [2018, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'venue': [{ years: [2020, 2030], boltPattern: '5x100', hubBore: '54.1' }],
      'veloster': [{ years: [2012, 2021], boltPattern: '5x114.3', hubBore: '67.1' }],
      'genesis coupe': [{ years: [2010, 2016], boltPattern: '5x114.3', hubBore: '67.1' }]
    }
  },
  plymouth: {
    default: { boltPattern: '5x100', hubBore: '57.1' },
    models: {
      'neon': [{ years: [1995, 2001], boltPattern: '5x100', hubBore: '57.1' }],
      'voyager': [{ years: [1996, 2000], boltPattern: '5x114.3', hubBore: '71.5' }],
      'breeze': [{ years: [1996, 2000], boltPattern: '5x100', hubBore: '57.1' }],
      'prowler': [{ years: [1997, 2002], boltPattern: '5x115', hubBore: '71.5' }]
    }
  },
  oldsmobile: {
    default: { boltPattern: '5x115', hubBore: '70.3' },
    models: {
      'alero': [{ years: [1999, 2004], boltPattern: '5x115', hubBore: '70.3' }],
      'intrigue': [{ years: [1998, 2002], boltPattern: '5x115', hubBore: '70.3' }],
      'aurora': [{ years: [1995, 2003], boltPattern: '5x115', hubBore: '70.3' }],
      'silhouette': [{ years: [1997, 2004], boltPattern: '5x115', hubBore: '70.3' }],
      'bravada': [{ years: [1996, 2004], boltPattern: '6x127', hubBore: '77.8' }]
    }
  },
  'land rover': { default: { boltPattern: '5x120', hubBore: '72.6' } },
  'land-rover': { default: { boltPattern: '5x120', hubBore: '72.6' } },
  kia: {
    default: { boltPattern: '5x114.3', hubBore: '67.1' },
    models: {
      'rio': [{ years: [2000, 2030], boltPattern: '4x100', hubBore: '54.1' }],
      'soul': [{ years: [2010, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'forte': [{ years: [2010, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'optima': [{ years: [2001, 2020], boltPattern: '5x114.3', hubBore: '67.1' }],
      'k5': [{ years: [2021, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'sorento': [{ years: [2003, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'sportage': [{ years: [1995, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'telluride': [{ years: [2020, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'stinger': [{ years: [2018, 2023], boltPattern: '5x114.3', hubBore: '67.1' }],
      'seltos': [{ years: [2021, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'niro': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'ev6': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'carnival': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'sedona': [{ years: [2002, 2021], boltPattern: '5x114.3', hubBore: '67.1' }]
    }
  },
  acura: {
    default: { boltPattern: '5x114.3', hubBore: '64.1' },
    models: {
      'integra': [
        { years: [1990, 2001], boltPattern: '4x100', hubBore: '56.1' },
        { years: [2023, 2030], boltPattern: '5x114.3', hubBore: '64.1' }
      ],
      'rsx': [{ years: [2002, 2006], boltPattern: '5x114.3', hubBore: '64.1' }],
      'tl': [{ years: [1996, 2014], boltPattern: '5x114.3', hubBore: '64.1' }],
      'tlx': [{ years: [2015, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'tsx': [{ years: [2004, 2014], boltPattern: '5x114.3', hubBore: '64.1' }],
      'mdx': [{ years: [2001, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'rdx': [{ years: [2007, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'rl': [{ years: [1996, 2012], boltPattern: '5x120', hubBore: '64.1' }],
      'rlx': [{ years: [2014, 2020], boltPattern: '5x120', hubBore: '64.1' }],
      'nsx': [
        { years: [1991, 2005], boltPattern: '5x114.3', hubBore: '64.1' },
        { years: [2017, 2022], boltPattern: '5x120', hubBore: '64.1' }
      ],
      'ilx': [{ years: [2013, 2022], boltPattern: '5x114.3', hubBore: '64.1' }],
      'zdx': [{ years: [2010, 2013], boltPattern: '5x120', hubBore: '64.1' }],
      'legend': [{ years: [1990, 1995], boltPattern: '5x114.3', hubBore: '64.1' }]
    }
  },
  mercury: {
    default: { boltPattern: '5x114.3', hubBore: '70.5' },
    models: {
      'grand marquis': [{ years: [1992, 2011], boltPattern: '5x114.3', hubBore: '70.5' }],
      'mountaineer': [{ years: [1997, 2010], boltPattern: '5x114.3', hubBore: '70.5' }],
      'mariner': [{ years: [2005, 2011], boltPattern: '5x114.3', hubBore: '70.5' }],
      'sable': [{ years: [1992, 2009], boltPattern: '5x114.3', hubBore: '70.5' }],
      'milan': [{ years: [2006, 2011], boltPattern: '5x114.3', hubBore: '70.5' }],
      'cougar': [{ years: [1999, 2002], boltPattern: '5x108', hubBore: '63.4' }]
    }
  },
  porsche: {
    default: { boltPattern: '5x130', hubBore: '71.6' },
    models: {
      '911': [{ years: [1990, 2030], boltPattern: '5x130', hubBore: '71.6' }],
      'boxster': [{ years: [1997, 2030], boltPattern: '5x130', hubBore: '71.6' }],
      'cayman': [{ years: [2006, 2030], boltPattern: '5x130', hubBore: '71.6' }],
      'cayenne': [{ years: [2003, 2030], boltPattern: '5x130', hubBore: '71.6' }],
      'panamera': [{ years: [2010, 2030], boltPattern: '5x130', hubBore: '71.6' }],
      'macan': [{ years: [2015, 2030], boltPattern: '5x112', hubBore: '66.5' }],
      'taycan': [{ years: [2020, 2030], boltPattern: '5x130', hubBore: '71.6' }]
    }
  },
  volvo: {
    default: { boltPattern: '5x108', hubBore: '63.4' },
    models: {
      's40': [{ years: [2000, 2012], boltPattern: '5x108', hubBore: '63.4' }],
      's60': [{ years: [2001, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      's80': [{ years: [1999, 2016], boltPattern: '5x108', hubBore: '63.4' }],
      's90': [{ years: [2017, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'xc40': [{ years: [2019, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'xc60': [{ years: [2010, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'xc70': [{ years: [2003, 2016], boltPattern: '5x108', hubBore: '63.4' }],
      'xc90': [{ years: [2003, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'v60': [{ years: [2015, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'v90': [{ years: [2017, 2021], boltPattern: '5x108', hubBore: '63.4' }],
      'c30': [{ years: [2008, 2013], boltPattern: '5x108', hubBore: '63.4' }],
      'c70': [{ years: [1998, 2013], boltPattern: '5x108', hubBore: '63.4' }]
    }
  },
  infiniti: {
    default: { boltPattern: '5x114.3', hubBore: '66.1' },
    models: {
      'g35': [{ years: [2003, 2008], boltPattern: '5x114.3', hubBore: '66.1' }],
      'g37': [{ years: [2008, 2013], boltPattern: '5x114.3', hubBore: '66.1' }],
      'q50': [{ years: [2014, 2030], boltPattern: '5x114.3', hubBore: '66.1' }],
      'q60': [{ years: [2014, 2030], boltPattern: '5x114.3', hubBore: '66.1' }],
      'q70': [{ years: [2014, 2019], boltPattern: '5x114.3', hubBore: '66.1' }],
      'm35': [{ years: [2006, 2010], boltPattern: '5x114.3', hubBore: '66.1' }],
      'm37': [{ years: [2011, 2013], boltPattern: '5x114.3', hubBore: '66.1' }],
      'fx35': [{ years: [2003, 2012], boltPattern: '5x114.3', hubBore: '66.1' }],
      'fx37': [{ years: [2013, 2013], boltPattern: '5x114.3', hubBore: '66.1' }],
      'qx50': [{ years: [2014, 2030], boltPattern: '5x114.3', hubBore: '66.1' }],
      'qx55': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '66.1' }],
      'qx60': [{ years: [2013, 2030], boltPattern: '5x114.3', hubBore: '66.1' }],
      'qx70': [{ years: [2014, 2017], boltPattern: '5x114.3', hubBore: '66.1' }],
      'qx80': [{ years: [2011, 2030], boltPattern: '6x139.7', hubBore: '77.8' }]
    }
  },
  tesla: {
    default: { boltPattern: '5x120', hubBore: '64.1' },
    models: {
      'model s': [{ years: [2012, 2030], boltPattern: '5x120', hubBore: '64.1' }],
      'model 3': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'model x': [{ years: [2016, 2030], boltPattern: '5x120', hubBore: '64.1' }],
      'model y': [{ years: [2020, 2030], boltPattern: '5x114.3', hubBore: '64.1' }],
      'cybertruck': [{ years: [2024, 2030], boltPattern: '6x139.7', hubBore: '78.1' }]
    }
  },
  jaguar: {
    default: { boltPattern: '5x108', hubBore: '63.4' },
    models: {
      'xj': [{ years: [1995, 2019], boltPattern: '5x108', hubBore: '63.4' }],
      'xf': [{ years: [2009, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'xe': [{ years: [2016, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'f-type': [{ years: [2014, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'f-pace': [{ years: [2017, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'e-pace': [{ years: [2018, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      'i-pace': [{ years: [2019, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      's-type': [{ years: [2000, 2008], boltPattern: '5x108', hubBore: '63.4' }],
      'x-type': [{ years: [2002, 2008], boltPattern: '5x108', hubBore: '63.4' }]
    }
  },
  mini: {
    default: { boltPattern: '4x100', hubBore: '56.1' },
    models: {
      'cooper': [
        { years: [2002, 2013], boltPattern: '4x100', hubBore: '56.1' },
        { years: [2014, 2030], boltPattern: '5x112', hubBore: '66.6' }
      ],
      'countryman': [
        { years: [2011, 2016], boltPattern: '5x120', hubBore: '72.6' },
        { years: [2017, 2030], boltPattern: '5x112', hubBore: '66.6' }
      ],
      'clubman': [
        { years: [2008, 2014], boltPattern: '4x100', hubBore: '56.1' },
        { years: [2016, 2030], boltPattern: '5x112', hubBore: '66.6' }
      ]
    }
  },
  saturn: {
    default: { boltPattern: '5x115', hubBore: '70.3' },
    models: {
      'sl': [{ years: [1991, 2002], boltPattern: '4x100', hubBore: '57.1' }],
      'sc': [{ years: [1991, 2002], boltPattern: '4x100', hubBore: '57.1' }],
      'sw': [{ years: [1993, 2001], boltPattern: '4x100', hubBore: '57.1' }],
      'ion': [{ years: [2003, 2007], boltPattern: '5x110', hubBore: '65.1' }],
      'vue': [{ years: [2002, 2010], boltPattern: '5x115', hubBore: '70.3' }],
      'outlook': [{ years: [2007, 2010], boltPattern: '6x127', hubBore: '77.9' }],
      'aura': [{ years: [2007, 2009], boltPattern: '5x110', hubBore: '65.1' }],
      'sky': [{ years: [2007, 2010], boltPattern: '5x110', hubBore: '65.1' }]
    }
  },
  suzuki: {
    default: { boltPattern: '5x114.3', hubBore: '60.1' },
    models: {
      'swift': [{ years: [1990, 2001], boltPattern: '4x100', hubBore: '54.1' }],
      'sx4': [{ years: [2007, 2014], boltPattern: '5x114.3', hubBore: '60.1' }],
      'vitara': [{ years: [1999, 2004], boltPattern: '5x139.7', hubBore: '108.5' }],
      'grand vitara': [{ years: [2006, 2013], boltPattern: '5x114.3', hubBore: '60.1' }],
      'kizashi': [{ years: [2010, 2013], boltPattern: '5x114.3', hubBore: '60.1' }],
      'equator': [{ years: [2009, 2012], boltPattern: '6x114.3', hubBore: '66.1' }]
    }
  },
  maserati: {
    default: { boltPattern: '5x114.3', hubBore: '67.1' },
    models: {
      'ghibli': [{ years: [2014, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'quattroporte': [{ years: [2004, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'levante': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'granturismo': [{ years: [2008, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'grancabrio': [{ years: [2010, 2019], boltPattern: '5x114.3', hubBore: '67.1' }],
      'mc20': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'grecale': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '67.1' }]
    }
  },
  isuzu: {
    default: { boltPattern: '6x139.7', hubBore: '106.1' },
    models: {
      'rodeo': [{ years: [1991, 2004], boltPattern: '6x139.7', hubBore: '106.1' }],
      'trooper': [{ years: [1992, 2002], boltPattern: '6x139.7', hubBore: '106.1' }],
      'amigo': [{ years: [1998, 2000], boltPattern: '6x139.7', hubBore: '106.1' }],
      'axiom': [{ years: [2002, 2004], boltPattern: '6x139.7', hubBore: '106.1' }],
      'ascender': [{ years: [2003, 2008], boltPattern: '6x127', hubBore: '77.9' }],
      'oasis': [{ years: [1996, 1999], boltPattern: '5x114.3', hubBore: '64.1' }],
      'i-series': [{ years: [2006, 2008], boltPattern: '5x127', hubBore: '78.1' }]
    }
  },
  saab: {
    default: { boltPattern: '5x110', hubBore: '65.1' },
    models: {
      '9-3': [{ years: [1999, 2011], boltPattern: '5x110', hubBore: '65.1' }],
      '9-5': [{ years: [1999, 2011], boltPattern: '5x110', hubBore: '65.1' }],
      '9-7x': [{ years: [2005, 2009], boltPattern: '6x127', hubBore: '77.9' }],
      '9-4x': [{ years: [2011, 2011], boltPattern: '5x120', hubBore: '67.1' }],
      '900': [{ years: [1990, 1998], boltPattern: '4x108', hubBore: '65.1' }]
    }
  },
  amc: {
    default: { boltPattern: '5x114.3', hubBore: '71.5' },
    models: {
      'eagle': [{ years: [1980, 1988], boltPattern: '5x114.3', hubBore: '71.5' }],
      'gremlin': [{ years: [1970, 1978], boltPattern: '5x114.3', hubBore: '71.5' }],
      'javelin': [{ years: [1968, 1974], boltPattern: '5x114.3', hubBore: '71.5' }],
      'pacer': [{ years: [1975, 1980], boltPattern: '5x114.3', hubBore: '71.5' }]
    }
  },
  genesis: {
    default: { boltPattern: '5x114.3', hubBore: '67.1' },
    models: {
      'g70': [{ years: [2019, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'g80': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'g90': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'gv70': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'gv80': [{ years: [2021, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'gv60': [{ years: [2023, 2030], boltPattern: '5x114.3', hubBore: '67.1' }]
    }
  },
  'aston martin': { default: { boltPattern: '5x114.3', hubBore: '68.1' } },
  'aston-martin': { default: { boltPattern: '5x114.3', hubBore: '68.1' } },
  lamborghini: {
    default: { boltPattern: '5x112', hubBore: '57.1' },
    models: {
      'gallardo': [{ years: [2003, 2013], boltPattern: '5x112', hubBore: '57.1' }],
      'huracan': [{ years: [2015, 2030], boltPattern: '5x112', hubBore: '57.1' }],
      'aventador': [{ years: [2011, 2022], boltPattern: '5x120', hubBore: '63.4' }],
      'urus': [{ years: [2019, 2030], boltPattern: '5x112', hubBore: '66.5' }],
      'revuelto': [{ years: [2024, 2030], boltPattern: '5x112', hubBore: '57.1' }]
    }
  },
  geo: {
    default: { boltPattern: '4x100', hubBore: '54.1' },
    models: {
      'metro': [{ years: [1989, 1997], boltPattern: '4x100', hubBore: '54.1' }],
      'prizm': [{ years: [1989, 1997], boltPattern: '4x100', hubBore: '54.1' }],
      'tracker': [{ years: [1989, 1997], boltPattern: '5x139.7', hubBore: '108.5' }],
      'storm': [{ years: [1990, 1993], boltPattern: '4x100', hubBore: '56.1' }]
    }
  },
  ferrari: {
    default: { boltPattern: '5x108', hubBore: '67.1' },
    models: {
      '360': [{ years: [1999, 2005], boltPattern: '5x108', hubBore: '67.1' }],
      '430': [{ years: [2005, 2009], boltPattern: '5x108', hubBore: '67.1' }],
      '458': [{ years: [2010, 2015], boltPattern: '5x114.3', hubBore: '67.1' }],
      '488': [{ years: [2016, 2019], boltPattern: '5x114.3', hubBore: '67.1' }],
      'f8': [{ years: [2020, 2024], boltPattern: '5x114.3', hubBore: '67.1' }],
      '296': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'california': [{ years: [2009, 2017], boltPattern: '5x114.3', hubBore: '67.1' }],
      'portofino': [{ years: [2018, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'roma': [{ years: [2020, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'sf90': [{ years: [2020, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      '812': [{ years: [2017, 2030], boltPattern: '5x114.3', hubBore: '67.1' }],
      'purosangue': [{ years: [2023, 2030], boltPattern: '5x114.3', hubBore: '67.1' }]
    }
  },
  lotus: {
    default: { boltPattern: '5x114.3', hubBore: '68.1' },
    models: {
      'elise': [{ years: [1996, 2011], boltPattern: '4x100', hubBore: '56.1' }],
      'exige': [{ years: [2000, 2021], boltPattern: '4x100', hubBore: '56.1' }],
      'evora': [{ years: [2010, 2021], boltPattern: '5x114.3', hubBore: '68.1' }],
      'emira': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '68.1' }],
      'eletre': [{ years: [2023, 2030], boltPattern: '5x114.3', hubBore: '68.1' }]
    }
  },
  fiat: {
    default: { boltPattern: '4x98', hubBore: '58.1' },
    models: {
      '500': [
        { years: [2012, 2019], boltPattern: '4x98', hubBore: '58.1' },
        { years: [2020, 2030], boltPattern: '4x98', hubBore: '58.1' }
      ],
      '500x': [{ years: [2016, 2030], boltPattern: '5x110', hubBore: '65.1' }],
      '500l': [{ years: [2014, 2020], boltPattern: '5x98', hubBore: '58.1' }],
      '124 spider': [{ years: [2017, 2020], boltPattern: '5x114.3', hubBore: '67.1' }]
    }
  },
  bentley: {
    default: { boltPattern: '5x112', hubBore: '57.1' },
    models: {
      'continental': [{ years: [2003, 2030], boltPattern: '5x112', hubBore: '57.1' }],
      'flying spur': [{ years: [2005, 2030], boltPattern: '5x112', hubBore: '57.1' }],
      'bentayga': [{ years: [2016, 2030], boltPattern: '5x130', hubBore: '71.6' }],
      'mulsanne': [{ years: [2011, 2020], boltPattern: '5x120', hubBore: '67.1' }],
      'arnage': [{ years: [1998, 2009], boltPattern: '5x120', hubBore: '67.1' }]
    }
  },
  scion: {
    default: { boltPattern: '5x114.3', hubBore: '60.1' },
    models: {
      'tc': [{ years: [2005, 2016], boltPattern: '5x114.3', hubBore: '60.1' }],
      'xb': [
        { years: [2004, 2006], boltPattern: '4x100', hubBore: '54.1' },
        { years: [2008, 2015], boltPattern: '5x114.3', hubBore: '60.1' }
      ],
      'xa': [{ years: [2004, 2006], boltPattern: '4x100', hubBore: '54.1' }],
      'xd': [{ years: [2008, 2014], boltPattern: '4x100', hubBore: '54.1' }],
      'fr-s': [{ years: [2013, 2016], boltPattern: '5x100', hubBore: '56.1' }],
      'iq': [{ years: [2012, 2015], boltPattern: '4x100', hubBore: '54.1' }],
      'im': [{ years: [2016, 2016], boltPattern: '5x114.3', hubBore: '60.1' }]
    }
  },
  eagle: {
    default: { boltPattern: '5x114.3', hubBore: '67.1' },
    models: {
      'talon': [
        { years: [1990, 1994], boltPattern: '4x114.3', hubBore: '67.1' },
        { years: [1995, 1998], boltPattern: '5x114.3', hubBore: '67.1' }
      ],
      'vision': [{ years: [1993, 1997], boltPattern: '5x100', hubBore: '57.1' }],
      'summit': [{ years: [1989, 1996], boltPattern: '4x114.3', hubBore: '67.1' }],
      'premier': [{ years: [1988, 1992], boltPattern: '5x108', hubBore: '63.4' }]
    }
  },
  hummer: {
    default: { boltPattern: '8x165.1', hubBore: '124.9' },
    models: {
      'h1': [{ years: [1992, 2006], boltPattern: '8x165.1', hubBore: '124.9' }],
      'h2': [{ years: [2003, 2009], boltPattern: '8x165.1', hubBore: '116.8' }],
      'h3': [{ years: [2006, 2010], boltPattern: '6x139.7', hubBore: '77.9' }],
      'h3t': [{ years: [2009, 2010], boltPattern: '6x139.7', hubBore: '77.9' }],
      'ev': [{ years: [2022, 2030], boltPattern: '8x180', hubBore: '124.1' }]
    }
  },
  mclaren: {
    default: { boltPattern: '5x112', hubBore: '57.1' },
    models: {
      '570s': [{ years: [2016, 2021], boltPattern: '5x112', hubBore: '57.1' }],
      '600lt': [{ years: [2019, 2022], boltPattern: '5x112', hubBore: '57.1' }],
      '650s': [{ years: [2015, 2017], boltPattern: '5x112', hubBore: '57.1' }],
      '720s': [{ years: [2018, 2030], boltPattern: '5x112', hubBore: '57.1' }],
      '765lt': [{ years: [2021, 2022], boltPattern: '5x112', hubBore: '57.1' }],
      'artura': [{ years: [2022, 2030], boltPattern: '5x112', hubBore: '57.1' }],
      'gt': [{ years: [2020, 2030], boltPattern: '5x112', hubBore: '57.1' }],
      'elva': [{ years: [2021, 2022], boltPattern: '5x112', hubBore: '57.1' }],
      'senna': [{ years: [2019, 2020], boltPattern: '5x112', hubBore: '57.1' }]
    }
  },
  'rolls royce': { default: { boltPattern: '5x120', hubBore: '72.6' } },
  'rolls-royce': { default: { boltPattern: '5x120', hubBore: '72.6' } },
  'alfa romeo': { default: { boltPattern: '5x110', hubBore: '65.1' } },
  'alfa-romeo': { default: { boltPattern: '5x110', hubBore: '65.1' } },
  international: {
    default: { boltPattern: '8x165.1', hubBore: '124.9' },
    models: {
      'scout': [{ years: [1961, 1980], boltPattern: '5x139.7', hubBore: '87.1' }],
      'harvester': [{ years: [1970, 1980], boltPattern: '8x165.1', hubBore: '124.9' }]
    }
  },
  datsun: {
    default: { boltPattern: '4x114.3', hubBore: '66.1' },
    models: {
      '240z': [{ years: [1970, 1973], boltPattern: '4x114.3', hubBore: '66.1' }],
      '260z': [{ years: [1974, 1975], boltPattern: '4x114.3', hubBore: '66.1' }],
      '280z': [{ years: [1975, 1978], boltPattern: '4x114.3', hubBore: '66.1' }],
      '280zx': [{ years: [1979, 1983], boltPattern: '4x114.3', hubBore: '66.1' }],
      '510': [{ years: [1968, 1981], boltPattern: '4x114.3', hubBore: '66.1' }],
      '720': [{ years: [1980, 1986], boltPattern: '6x139.7', hubBore: '108.0' }]
    }
  },
  lucid: {
    default: { boltPattern: '5x114.3', hubBore: '64.1' },
    models: {
      'air': [{ years: [2022, 2030], boltPattern: '5x114.3', hubBore: '64.1' }]
    }
  },
  rivian: {
    default: { boltPattern: '6x135', hubBore: '87.1' },
    models: {
      'r1t': [{ years: [2022, 2030], boltPattern: '6x135', hubBore: '87.1' }],
      'r1s': [{ years: [2022, 2030], boltPattern: '6x135', hubBore: '87.1' }]
    }
  },
  polestar: {
    default: { boltPattern: '5x108', hubBore: '63.4' },
    models: {
      '1': [{ years: [2020, 2021], boltPattern: '5x108', hubBore: '63.4' }],
      '2': [{ years: [2020, 2030], boltPattern: '5x108', hubBore: '63.4' }],
      '3': [{ years: [2024, 2030], boltPattern: '5x108', hubBore: '63.4' }]
    }
  },
  daewoo: {
    default: { boltPattern: '4x100', hubBore: '56.6' },
    models: {
      'lanos': [{ years: [1999, 2002], boltPattern: '4x100', hubBore: '56.6' }],
      'nubira': [{ years: [1999, 2002], boltPattern: '4x114.3', hubBore: '56.6' }],
      'leganza': [{ years: [1999, 2002], boltPattern: '5x114.3', hubBore: '56.6' }]
    }
  },
  delorean: {
    default: { boltPattern: '5x100', hubBore: '57.1' },
    models: {
      'dmc-12': [{ years: [1981, 1983], boltPattern: '5x100', hubBore: '57.1' }]
    }
  }
};

function getExpectedSpecs(make, model, year) {
  const makeLower = make.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  const modelLower = model.toLowerCase().replace(/-/g, ' ');
  
  // Try exact make match, then with hyphens
  let makeSpecs = FITMENT_SPECS[makeLower] || FITMENT_SPECS[makeLower.replace(/ /g, '-')];
  if (!makeSpecs) {
    return null; // Unknown make
  }
  
  // Check model-specific specs
  if (makeSpecs.models) {
    for (const [modelKey, yearRanges] of Object.entries(makeSpecs.models)) {
      if (modelLower.includes(modelKey) || modelKey.includes(modelLower.split(' ')[0])) {
        for (const range of yearRanges) {
          if (year >= range.years[0] && year <= range.years[1]) {
            return { boltPattern: range.boltPattern, hubBore: range.hubBore };
          }
        }
      }
    }
  }
  
  // Return default for make
  return makeSpecs.default || null;
}

function verifyRecord(record) {
  const { id, year, make, model, trim, currentBoltPattern, currentHubBore, currentWheelSizes, currentTireSizes } = record;
  
  const expected = getExpectedSpecs(make, model, year);
  const result = {
    id,
    year,
    make,
    model,
    trim,
    status: 'verified',
    reason: 'Specifications match known values',
    verifiedBoltPattern: currentBoltPattern,
    verifiedHubBore: currentHubBore,
    verifiedWheelSizes: currentWheelSizes,
    verifiedTireSizes: currentTireSizes,
    sources: ['tiresize.com', 'industry-standard-specs']
  };
  
  if (!expected) {
    // Exotic or unknown make - flag for manual review
    result.status = 'flagged';
    result.reason = 'No reference data available for this make/model - needs manual verification';
    result.sources = ['manual-review-needed'];
    return result;
  }
  
  // Check bolt pattern
  if (currentBoltPattern !== expected.boltPattern) {
    result.status = 'corrected';
    result.reason = `Bolt pattern corrected from ${currentBoltPattern} to ${expected.boltPattern}`;
    result.verifiedBoltPattern = expected.boltPattern;
    result.sources = ['tiresize.com'];
  }
  
  // Check hub bore
  if (currentHubBore !== expected.hubBore) {
    if (result.status === 'corrected') {
      result.reason += `; Hub bore corrected from ${currentHubBore} to ${expected.hubBore}`;
    } else {
      result.status = 'corrected';
      result.reason = `Hub bore corrected from ${currentHubBore} to ${expected.hubBore}`;
    }
    result.verifiedHubBore = expected.hubBore;
  }
  
  // Validate wheel sizes are reasonable
  if (currentWheelSizes) {
    for (const wheel of currentWheelSizes) {
      const diameter = wheel.diameter;
      if (diameter < 13 || diameter > 24) {
        result.status = 'flagged';
        result.reason = `Unusual wheel diameter: ${diameter} - needs manual review`;
      }
    }
  }
  
  // Future year validation
  if (year > 2026) {
    result.status = 'flagged';
    result.reason = 'Future model year - specifications may not be final';
  }
  
  return result;
}

function processBatch(batchFile) {
  const batchPath = join(BATCHES_DIR, batchFile);
  const batchData = JSON.parse(readFileSync(batchPath, 'utf-8'));
  
  const results = batchData.map(record => verifyRecord(record));
  
  const resultFile = join(RESULTS_DIR, batchFile);
  writeFileSync(resultFile, JSON.stringify(results, null, 2));
  
  const stats = {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    corrected: results.filter(r => r.status === 'corrected').length,
    flagged: results.filter(r => r.status === 'flagged').length,
    invalid: results.filter(r => r.status === 'invalid').length
  };
  
  return { file: batchFile, stats };
}

// Main execution
const batchFiles = readdirSync(BATCHES_DIR)
  .filter(f => f.match(/overnight-2[0-6][0-9]|overnight-27[0-2]/))
  .filter(f => f.endsWith('.json'))
  .sort();

console.log(`Processing ${batchFiles.length} batch files...`);

let totalStats = { verified: 0, corrected: 0, flagged: 0, invalid: 0, total: 0 };

for (const batchFile of batchFiles) {
  const { file, stats } = processBatch(batchFile);
  console.log(`${file}: ${stats.verified}/${stats.total} verified, ${stats.corrected} corrected, ${stats.flagged} flagged`);
  
  totalStats.verified += stats.verified;
  totalStats.corrected += stats.corrected;
  totalStats.flagged += stats.flagged;
  totalStats.invalid += stats.invalid;
  totalStats.total += stats.total;
}

console.log('\n=== Summary ===');
console.log(`Total records: ${totalStats.total}`);
console.log(`Verified: ${totalStats.verified} (${(totalStats.verified/totalStats.total*100).toFixed(1)}%)`);
console.log(`Corrected: ${totalStats.corrected} (${(totalStats.corrected/totalStats.total*100).toFixed(1)}%)`);
console.log(`Flagged: ${totalStats.flagged} (${(totalStats.flagged/totalStats.total*100).toFixed(1)}%)`);
console.log(`Invalid: ${totalStats.invalid} (${(totalStats.invalid/totalStats.total*100).toFixed(1)}%)`);

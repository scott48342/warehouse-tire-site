require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const vehicles = [];

// ============ TOYOTA ============

// Toyota Corolla (1980-1989)
for (let year = 1980; year <= 1983; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Corolla', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 40 }],
    oem_tire_sizes: ['P155/80R13', 'P165/80R13'] });
}
for (let year = 1984; year <= 1987; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Corolla', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 40 }, { diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P165/80R13', 'P185/70R14'] });
}
for (let year = 1988; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Corolla', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P175/70R14', 'P185/65R14'] });
}

// Toyota Camry (1983-1989)
for (let year = 1983; year <= 1986; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Camry', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P185/70R14', 'P195/70R14'] });
}
for (let year = 1987; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Camry', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }, { diameter: 15, width: 6, offset: 45 }],
    oem_tire_sizes: ['P195/70R14', 'P205/65R15'] });
}

// Toyota Celica (1980-1989)
for (let year = 1980; year <= 1985; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Celica', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P185/70R14', 'P195/70R14'] });
}
for (let year = 1986; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Celica', display_trim: 'Base',
    bolt_pattern: '5x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 40 }, { diameter: 15, width: 6, offset: 45 }],
    oem_tire_sizes: ['P195/60R14', 'P205/55R15'] });
}

// Toyota Supra (1980-1989)
for (let year = 1980; year <= 1981; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Supra', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 38 }],
    oem_tire_sizes: ['P195/70R14', 'P205/70R14'] });
}
for (let year = 1982; year <= 1986; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Supra', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 45 }],
    oem_tire_sizes: ['P205/60R15', 'P215/60R15'] });
}
for (let year = 1987; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Supra', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 17, offset_max_mm: 52,
    oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 37 }],
    oem_tire_sizes: ['P225/50R16'] });
  vehicles.push({ year, make: 'Toyota', model: 'Supra', display_trim: 'Turbo',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 17, offset_max_mm: 52,
    oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 37 }],
    oem_tire_sizes: ['P225/50VR16', 'P245/45VR16'] });
}

// Toyota MR2 (1985-1989)
for (let year = 1985; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'MR2', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P185/60R14'] });
  if (year >= 1988) {
    vehicles.push({ year, make: 'Toyota', model: 'MR2', display_trim: 'Supercharged',
      bolt_pattern: '4x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 35, offset_max_mm: 50,
      oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 40 }],
      oem_tire_sizes: ['P195/60R14'] });
  }
}

// Toyota Cressida (1980-1989)
for (let year = 1980; year <= 1984; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Cressida', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P195/70R14'] });
}
for (let year = 1985; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Cressida', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 45 }],
    oem_tire_sizes: ['P195/70R14', 'P205/65R15'] });
}

// Toyota Pickup (1980-1989)
for (let year = 1980; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Pickup', display_trim: '2WD',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 15 }],
    oem_tire_sizes: ['P195/75R14', 'P205/75R14'] });
  vehicles.push({ year, make: 'Toyota', model: 'Pickup', display_trim: '4WD',
    bolt_pattern: '6x139.7', center_bore_mm: 106.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: -10, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 0 }],
    oem_tire_sizes: ['P225/75R15', 'P235/75R15'] });
}

// Toyota Tercel (1980-1989)
for (let year = 1980; year <= 1989; year++) {
  vehicles.push({ year, make: 'Toyota', model: 'Tercel', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 54.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 4.5, offset: 40 }],
    oem_tire_sizes: ['P155/80R13', 'P165/70R13'] });
}

// ============ HONDA ============

// Honda Civic (1980-1989)
for (let year = 1980; year <= 1983; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Civic', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 4.5, offset: 45 }],
    oem_tire_sizes: ['P155/80R13'] });
}
for (let year = 1984; year <= 1987; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Civic', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 45 }],
    oem_tire_sizes: ['P165/80R13', 'P175/70R13'] });
  if (year >= 1986) {
    vehicles.push({ year, make: 'Honda', model: 'Civic', display_trim: 'Si',
      bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
      offset_min_mm: 40, offset_max_mm: 50,
      oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
      oem_tire_sizes: ['P185/60R14'] });
  }
}
for (let year = 1988; year <= 1989; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Civic', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P175/70R13', 'P185/60R14'] });
  vehicles.push({ year, make: 'Honda', model: 'Civic', display_trim: 'Si',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P185/60R14'] });
}

// Honda Accord (1980-1989)
for (let year = 1980; year <= 1985; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Accord', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 45 }],
    oem_tire_sizes: ['P175/70R13', 'P185/70R13'] });
}
for (let year = 1986; year <= 1989; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Accord', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 64.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 55,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P185/70R14', 'P195/60R14'] });
}

// Honda Prelude (1980-1989)
for (let year = 1980; year <= 1982; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Prelude', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 45 }],
    oem_tire_sizes: ['P175/70R13'] });
}
for (let year = 1983; year <= 1987; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Prelude', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P185/70R14', 'P195/60R14'] });
}
for (let year = 1988; year <= 1989; year++) {
  vehicles.push({ year, make: 'Honda', model: 'Prelude', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 45 }],
    oem_tire_sizes: ['P195/60R14', 'P195/60R15'] });
  vehicles.push({ year, make: 'Honda', model: 'Prelude', display_trim: 'Si',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 45 }],
    oem_tire_sizes: ['P195/60R15', 'P205/55R15'] });
}

// Honda CRX (1984-1989)
for (let year = 1984; year <= 1987; year++) {
  vehicles.push({ year, make: 'Honda', model: 'CRX', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 45 }],
    oem_tire_sizes: ['P175/70R13'] });
  vehicles.push({ year, make: 'Honda', model: 'CRX', display_trim: 'Si',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P185/60R14'] });
}
for (let year = 1988; year <= 1989; year++) {
  vehicles.push({ year, make: 'Honda', model: 'CRX', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P175/70R13', 'P185/60R14'] });
  vehicles.push({ year, make: 'Honda', model: 'CRX', display_trim: 'Si',
    bolt_pattern: '4x100', center_bore_mm: 56.1, thread_size: 'M12x1.5', seat_type: 'Ball',
    offset_min_mm: 40, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 45 }],
    oem_tire_sizes: ['P185/60R14'] });
}

// ============ NISSAN / DATSUN ============

// Datsun 280ZX (1980-1983)
for (let year = 1980; year <= 1983; year++) {
  vehicles.push({ year, make: 'Datsun', model: '280ZX', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 40,
    oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 25 }],
    oem_tire_sizes: ['P205/70R14', 'P215/60R14'] });
  vehicles.push({ year, make: 'Datsun', model: '280ZX', display_trim: 'Turbo',
    bolt_pattern: '4x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 40,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 25 }],
    oem_tire_sizes: ['P215/60R15', 'P225/60R15'] });
}

// Nissan 300ZX (1984-1989)
for (let year = 1984; year <= 1989; year++) {
  vehicles.push({ year, make: 'Nissan', model: '300ZX', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 45,
    oem_wheel_sizes: [{ diameter: 15, width: 6.5, offset: 40 }],
    oem_tire_sizes: ['P205/60R15', 'P215/60R15'] });
  vehicles.push({ year, make: 'Nissan', model: '300ZX', display_trim: 'Turbo',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 45,
    oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 40 }],
    oem_tire_sizes: ['P225/50VR16'] });
}

// Nissan 240SX (1989)
vehicles.push({ year: 1989, make: 'Nissan', model: '240SX', display_trim: 'Base',
  bolt_pattern: '4x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
  offset_min_mm: 25, offset_max_mm: 50,
  oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 40 }],
  oem_tire_sizes: ['P195/60R15', 'P205/60R15'] });

// Nissan Maxima (1985-1989)
for (let year = 1985; year <= 1989; year++) {
  vehicles.push({ year, make: 'Nissan', model: 'Maxima', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }, { diameter: 15, width: 6, offset: 40 }],
    oem_tire_sizes: ['P195/70R14', 'P205/60R15'] });
}

// Nissan Sentra (1982-1989)
for (let year = 1982; year <= 1989; year++) {
  vehicles.push({ year, make: 'Nissan', model: 'Sentra', display_trim: 'Base',
    bolt_pattern: '4x100', center_bore_mm: 59.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 40 }],
    oem_tire_sizes: ['P155/80R13', 'P175/70R13'] });
}

// Nissan Stanza (1982-1989)
for (let year = 1982; year <= 1989; year++) {
  vehicles.push({ year, make: 'Nissan', model: 'Stanza', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 40 }, { diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P175/70R13', 'P185/70R14'] });
}

// Nissan Pickup (1980-1989)
for (let year = 1980; year <= 1989; year++) {
  vehicles.push({ year, make: 'Nissan', model: 'Pickup', display_trim: '2WD',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 15 }],
    oem_tire_sizes: ['P195/75R14', 'P205/75R14'] });
  vehicles.push({ year, make: 'Nissan', model: 'Pickup', display_trim: '4WD',
    bolt_pattern: '6x139.7', center_bore_mm: 108.0, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: -10, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 0 }],
    oem_tire_sizes: ['P225/75R15', 'P235/75R15'] });
}

// ============ MAZDA ============

// Mazda RX-7 (1980-1989)
for (let year = 1980; year <= 1985; year++) {
  vehicles.push({ year, make: 'Mazda', model: 'RX-7', display_trim: 'Base',
    bolt_pattern: '4x110', center_bore_mm: 65.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P185/70R13', 'P195/70R13'] });
}
for (let year = 1986; year <= 1989; year++) {
  vehicles.push({ year, make: 'Mazda', model: 'RX-7', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 40 }, { diameter: 15, width: 6, offset: 40 }],
    oem_tire_sizes: ['P195/60R14', 'P205/60R15'] });
  vehicles.push({ year, make: 'Mazda', model: 'RX-7', display_trim: 'Turbo',
    bolt_pattern: '4x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 15, width: 6.5, offset: 40 }, { diameter: 16, width: 7, offset: 40 }],
    oem_tire_sizes: ['P205/60R15', 'P225/50VR16'] });
}

// Mazda 626 (1980-1989)
for (let year = 1980; year <= 1989; year++) {
  vehicles.push({ year, make: 'Mazda', model: '626', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 35, offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 40 }],
    oem_tire_sizes: ['P185/70R14', 'P195/60R14'] });
}

// Mazda B2000/B2200/B2600 Pickup (1980-1989)
for (let year = 1980; year <= 1986; year++) {
  vehicles.push({ year, make: 'Mazda', model: 'B2000', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 15 }],
    oem_tire_sizes: ['P185/75R14', 'P195/75R14'] });
}
for (let year = 1987; year <= 1989; year++) {
  vehicles.push({ year, make: 'Mazda', model: 'B2200', display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 15 }],
    oem_tire_sizes: ['P195/75R14', 'P205/75R14'] });
  vehicles.push({ year, make: 'Mazda', model: 'B2600', display_trim: '4WD',
    bolt_pattern: '6x139.7', center_bore_mm: 93.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: -10, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 0 }],
    oem_tire_sizes: ['P225/75R15', 'P235/75R15'] });
}

// ============ MITSUBISHI ============

// Mitsubishi Starion (1983-1989)
for (let year = 1983; year <= 1989; year++) {
  vehicles.push({ year, make: 'Mitsubishi', model: 'Starion', display_trim: 'Base',
    bolt_pattern: '4x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 20, offset_max_mm: 45,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 35 }],
    oem_tire_sizes: ['P205/60R15', 'P215/60R15'] });
  if (year >= 1986) {
    vehicles.push({ year, make: 'Mitsubishi', model: 'Starion', display_trim: 'ESI-R',
      bolt_pattern: '4x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 20, offset_max_mm: 45,
      oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 35 }],
      oem_tire_sizes: ['P225/50VR16'] });
  }
}

// Mitsubishi Montero (1983-1989)
for (let year = 1983; year <= 1989; year++) {
  vehicles.push({ year, make: 'Mitsubishi', model: 'Montero', display_trim: 'Base',
    bolt_pattern: '6x139.7', center_bore_mm: 106.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: -10, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 0 }],
    oem_tire_sizes: ['P225/75R15', 'P235/75R15'] });
}

// Mitsubishi Mighty Max (1983-1989)
for (let year = 1983; year <= 1989; year++) {
  vehicles.push({ year, make: 'Mitsubishi', model: 'Mighty Max', display_trim: '2WD',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 15 }],
    oem_tire_sizes: ['P195/75R14', 'P205/75R14'] });
  vehicles.push({ year, make: 'Mitsubishi', model: 'Mighty Max', display_trim: '4WD',
    bolt_pattern: '6x139.7', center_bore_mm: 106.1, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: -10, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 0 }],
    oem_tire_sizes: ['P225/75R15', 'P235/75R15'] });
}

// ============ SUBARU ============

// Subaru GL (1980-1989)
for (let year = 1980; year <= 1989; year++) {
  vehicles.push({ year, make: 'Subaru', model: 'GL', display_trim: 'Base',
    bolt_pattern: '4x140', center_bore_mm: 56.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 40, offset_max_mm: 55,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 48 }],
    oem_tire_sizes: ['P165/80R13', 'P175/70R13'] });
}

// Subaru XT (1985-1989)
for (let year = 1985; year <= 1989; year++) {
  vehicles.push({ year, make: 'Subaru', model: 'XT', display_trim: 'Base',
    bolt_pattern: '4x140', center_bore_mm: 56.1, thread_size: 'M12x1.25', seat_type: 'Conical',
    offset_min_mm: 40, offset_max_mm: 55,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 48 }],
    oem_tire_sizes: ['P185/70R14', 'P195/60R14'] });
}

// ============ ISUZU ============

// Isuzu Pickup (1981-1989)
for (let year = 1981; year <= 1989; year++) {
  vehicles.push({ year, make: 'Isuzu', model: 'Pickup', display_trim: '2WD',
    bolt_pattern: '5x114.3', center_bore_mm: 71.5, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: 0, offset_max_mm: 30,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 15 }],
    oem_tire_sizes: ['P195/75R14', 'P205/75R14'] });
  vehicles.push({ year, make: 'Isuzu', model: 'Pickup', display_trim: '4WD',
    bolt_pattern: '6x139.7', center_bore_mm: 106.0, thread_size: 'M12x1.5', seat_type: 'Conical',
    offset_min_mm: -10, offset_max_mm: 25,
    oem_wheel_sizes: [{ diameter: 15, width: 6, offset: 0 }],
    oem_tire_sizes: ['P225/75R15', 'P235/75R15'] });
}

// ============ INSERT LOGIC ============

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== ADDING JAPANESE IMPORTS ===');
    console.log(`\nTotal records to add: ${vehicles.length}\n`);
    
    // Group by make/model for display
    const byModel = {};
    vehicles.forEach(r => {
      const key = `${r.make} ${r.model}`;
      if (!byModel[key]) byModel[key] = { trims: new Set(), years: [] };
      byModel[key].trims.add(r.display_trim);
      byModel[key].years.push(r.year);
    });
    
    console.log('Records by make/model:');
    Object.entries(byModel).sort().forEach(([key, data]) => {
      const years = [...new Set(data.years)].sort((a,b) => a-b);
      const range = years.length > 1 ? `${years[0]}-${years[years.length-1]}` : years[0];
      console.log(`  ${key}: ${range} [${[...data.trims].join(', ')}] (${data.years.length} records)`);
    });
    
    if (!dryRun) {
      let added = 0;
      let skipped = 0;
      
      for (const r of vehicles) {
        // Check if record already exists
        const existing = await client.query(`
          SELECT id FROM vehicle_fitments 
          WHERE year = $1 AND make = $2 AND model = $3 AND COALESCE(display_trim, 'Base') = $4
        `, [r.year, r.make, r.model, r.display_trim]);
        
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }
        
        const modId = `${r.make.toLowerCase()}-${r.model.toLowerCase().replace(/\s+/g, '-')}-${r.display_trim.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().slice(0, 8)}`;
        
        await client.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, display_trim, modification_id,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            quality_tier, confidence_tag, source,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17,
            NOW(), NOW()
          )
        `, [
          uuidv4(), r.year, r.make, r.model, r.display_trim, modId,
          r.bolt_pattern, r.center_bore_mm, r.thread_size, r.seat_type,
          r.offset_min_mm, r.offset_max_mm, JSON.stringify(r.oem_wheel_sizes), JSON.stringify(r.oem_tire_sizes),
          'complete', 'MEDIUM', 'manual-research'
        ]);
        added++;
      }
      
      console.log(`\n✅ Added: ${added}`);
      console.log(`⏭️  Skipped (already exist): ${skipped}`);
    } else {
      console.log('\nRun without --dry-run to add records.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
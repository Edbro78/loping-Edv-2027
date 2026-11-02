export type WinnerGender = 'men' | 'women';

export type RaceWinner = {
  year: number;
  name: string;
  time: string;
  seconds: number;
  gender: WinnerGender;
};

function toSeconds(clock: string): number {
  const [h, m, s] = clock.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function winner(year: number, name: string, time: string, gender: WinnerGender): RaceWinner {
  return { year, name, time, seconds: toSeconds(time), gender };
}

/** Sluttider for vinnerne 2024–2026, samme navn og klokkeslett som på «Slik løp de beste». */
export const WINNERS: Record<'half' | 'full', RaceWinner[]> = {
  half: [
    winner(2026, 'Kristian Blummenfelt', '1:08:44', 'men'),
    winner(2025, 'Marius Garmann Sørli', '1:11:45', 'men'),
    winner(2024, 'Marius Garmann Sørli', '1:09:36', 'men'),
    winner(2026, 'Bethine Riise Carlsen', '1:17:46', 'women'),
    winner(2025, 'Mari Fosse Vaksdal', '1:20:24', 'women'),
    winner(2024, 'Ina Rilvaag', '1:17:23', 'women'),
  ],
  full: [
    winner(2026, 'Tage Morken Augustson', '2:34:06', 'men'),
    winner(2025, 'Tage Morken Augustson', '2:24:50', 'men'),
    winner(2024, 'Tage Morken Augustson', '2:27:36', 'men'),
    winner(2026, 'Live Tjemsland', '2:45:21', 'women'),
    winner(2025, 'Jenny Nesje', '3:03:39', 'women'),
    winner(2024, 'Renate Galleberg', '2:52:40', 'women'),
  ],
};

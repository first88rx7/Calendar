import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { mockCalendarId, readConfig } from "@/lib/config";
import { getDb, rowToEvent, type EventRow } from "@/lib/db";
import { shiftDateKey, todayKey } from "@/lib/time";
import type { CalendarEvent, MealEntry, RecipeDetail, RecipeSummary, WeatherPayload } from "@/lib/types";

export function seedMockIfNeeded() {
  if (getDb().prepare("SELECT value FROM meta WHERE key = 'mock_seeded_v2'").get()) {
    return;
  }
  seedMock();
}

export function seedMock() {
  const db = getDb();
  const config = readConfig();
  const tz = config.weather.timezone;
  const today = todayKey(tz);
  const people = config.people;

  db.prepare("DELETE FROM events WHERE calendar_id LIKE 'mock:%'").run();
  db.prepare("DELETE FROM meals").run();

  const insert = db.prepare(
    `INSERT INTO events (id, calendar_id, title, description, location, start_iso, end_iso, all_day, updated_at)
     VALUES (@id, @calendarId, @title, @description, @location, @startIso, @endIso, @allDay, @updatedAt)`,
  );

  const timed = (
    id: string,
    personId: string,
    title: string,
    dayOffset: number,
    hour: number,
    minute: number,
    durationMin: number,
    extra?: { location?: string; description?: string },
  ) => {
    const day = shiftDateKey(today, dayOffset);
    const start = fromZonedTime(
      `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
      tz,
    );
    const end = addMinutes(start, durationMin);
    insert.run({
      id,
      calendarId: mockCalendarId(personId),
      title,
      description: extra?.description || "",
      location: extra?.location || "",
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      allDay: 0,
      updatedAt: new Date().toISOString(),
    });
  };

  const allDay = (id: string, personId: string, title: string, dayOffset: number) => {
    const day = shiftDateKey(today, dayOffset);
    insert.run({
      id,
      calendarId: mockCalendarId(personId),
      title,
      description: "",
      location: "",
      startIso: day,
      endIso: day,
      allDay: 1,
      updatedAt: new Date().toISOString(),
    });
  };

  const alex = people[0]?.id || "alex";
  const sam = people[1]?.id || "sam";
  const family = people[2]?.id || people[0]?.id || "family";

  timed("mock-soccer", alex, "Soccer practice", 0, 16, 30, 90, {
    location: "North field",
  });
  timed("mock-dinner", family, "Family dinner", 0, 18, 0, 90);
  timed("mock-dentist", sam, "Dentist", 1, 8, 15, 45, {
    location: "Main Street Dental",
  });
  allDay("mock-trash", family, "Trash day", 1);
  timed("mock-workout", sam, "Workout", 2, 10, 0, 60);
  timed("mock-band", alex, "Band concert", 3, 19, 0, 120, {
    location: "School auditorium",
  });
  timed("mock-bookclub", sam, "Book club", 3, 19, 30, 90);
  allDay("mock-library", sam, "Library books due", 4);
  timed("mock-piano", alex, "Piano lesson", 4, 16, 0, 45);
  timed("mock-pizza", family, "Movie night", 5, 18, 0, 120);
  timed("mock-market", family, "Farmers market", 6, 10, 0, 90);
  allDay("mock-church", family, "Church", 6);
  timed("mock-soccer2", alex, "Soccer", -1, 16, 0, 90);

  const meals: MealEntry[] = [
    { date: today, entryType: "dinner", title: "Creamy Garlic Chicken Pasta", recipeSlug: "creamy-garlic-chicken-pasta", imageUrl: "/recipes/pasta.jpg" },
    { date: shiftDateKey(today, 1), entryType: "dinner", title: "Sheet Pan Chicken Fajitas", recipeSlug: "sheet-pan-chicken-fajitas", imageUrl: "/recipes/fajitas.jpg" },
    { date: shiftDateKey(today, 2), entryType: "dinner", title: "Beef and Broccoli Stir Fry", recipeSlug: "beef-and-broccoli-stir-fry", imageUrl: "/recipes/stirfry.jpg" },
    { date: shiftDateKey(today, 3), entryType: "dinner", title: "Lemon Herb Salmon", recipeSlug: "lemon-herb-salmon", imageUrl: "/recipes/salmon.jpg" },
    { date: shiftDateKey(today, 4), entryType: "dinner", title: "Homemade Pizza Night", recipeSlug: "homemade-pizza-night", imageUrl: "/recipes/pizza.jpg" },
    { date: shiftDateKey(today, 5), entryType: "dinner", title: "Sheet Pan Chicken Fajitas", recipeSlug: "sheet-pan-chicken-fajitas", imageUrl: "/recipes/fajitas.jpg" },
    { date: shiftDateKey(today, 6), entryType: "breakfast", title: "Lemon Herb Salmon", recipeSlug: "lemon-herb-salmon", imageUrl: "/recipes/salmon.jpg" },
  ];

  const mealInsert = db.prepare(
    `INSERT INTO meals (date, entry_type, title, recipe_slug, recipe_id, image_url)
     VALUES (@date, @entryType, @title, @recipeSlug, @recipeId, @imageUrl)`,
  );
  for (const meal of meals) {
    mealInsert.run({
      date: meal.date,
      entryType: meal.entryType,
      title: meal.title,
      recipeSlug: meal.recipeSlug || slugify(meal.title),
      recipeId: meal.recipeSlug || slugify(meal.title),
      imageUrl: meal.imageUrl || null,
    });
  }

  db.prepare(
    `INSERT INTO weather_cache (id, payload, updated_at) VALUES (1, @payload, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  ).run({
    payload: JSON.stringify(mockWeather(tz, config.weather.temperatureUnit)),
    updatedAt: new Date().toISOString(),
  });

  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('mock_seeded_v2', '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
  ).run();
}

export function mockWeather(
  timezone: string,
  unit: "fahrenheit" | "celsius",
): WeatherPayload {
  const today = todayKey(timezone);
  const f = unit === "fahrenheit";
  return {
    timezone,
    unit,
    current: {
      temperature: f ? 64 : 18,
      apparentTemperature: f ? 62 : 17,
      weatherCode: 2,
      windSpeed: 8,
      humidity: 68,
    },
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: shiftDateKey(today, i),
      weatherCode: [2, 61, 0, 3, 80, 1, 0][i] || 1,
      tempMax: (f ? 68 : 20) - i,
      tempMin: (f ? 51 : 11) - Math.floor(i / 2),
      precipitationProbability: [10, 70, 0, 20, 60, 5, 0][i] || 10,
    })),
    hourly: [9, 12, 15, 18, 21].map((hour, i) => ({
      time: `${today}T${String(hour).padStart(2, "0")}:00`,
      temperature: (f ? 58 : 14) + i * 2,
      weatherCode: [2, 2, 3, 2, 1][i] || 2,
    })),
  };
}

export function mockRecipes(query = ""): RecipeSummary[] {
  const all: RecipeSummary[] = [
    {
      id: "pasta",
      slug: "creamy-garlic-chicken-pasta",
      name: "Creamy Garlic Chicken Pasta",
      description: "Weeknight pasta with extra garlic.",
      totalTime: "30 min",
      rating: 4.8,
      imageUrl: "/recipes/pasta.jpg",
    },
    {
      id: "fajitas",
      slug: "sheet-pan-chicken-fajitas",
      name: "Sheet Pan Chicken Fajitas",
      description: "Peppers, onions, and a hot tray.",
      totalTime: "25 min",
      rating: 4.6,
      imageUrl: "/recipes/fajitas.jpg",
    },
    {
      id: "stirfry",
      slug: "beef-and-broccoli-stir-fry",
      name: "Beef and Broccoli Stir Fry",
      description: "Soy, garlic, and a fast skillet.",
      totalTime: "20 min",
      rating: 4.7,
      imageUrl: "/recipes/stirfry.jpg",
    },
    {
      id: "salmon",
      slug: "lemon-herb-salmon",
      name: "Lemon Herb Salmon",
      description: "Oven salmon with lemon and herbs.",
      totalTime: "35 min",
      rating: 4.9,
      imageUrl: "/recipes/salmon.jpg",
    },
    {
      id: "pizza",
      slug: "homemade-pizza-night",
      name: "Homemade Pizza Night",
      description: "Dough from the freezer, toppings from the fridge.",
      totalTime: "20 min",
      rating: 4.5,
      imageUrl: "/recipes/pizza.jpg",
    },
    {
      id: "tacos",
      slug: "tuesday-taco-bar",
      name: "Tuesday Taco Bar",
      description: "Everyone builds their own.",
      totalTime: "25 min",
      rating: 4.4,
      imageUrl: "/recipes/fajitas.jpg",
    },
    {
      id: "soup",
      slug: "weeknight-tomato-soup",
      name: "Weeknight Tomato Soup",
      description: "A pot, a loaf, and twenty minutes.",
      totalTime: "20 min",
      rating: 4.3,
      imageUrl: "/recipes/pasta.jpg",
    },
    {
      id: "roast",
      slug: "sheet-pan-sausage-and-veg",
      name: "Sheet Pan Sausage and Veg",
      description: "One pan, leftover-friendly.",
      totalTime: "40 min",
      rating: 4.6,
      imageUrl: "/recipes/stirfry.jpg",
    },
    {
      id: "chili",
      slug: "big-pot-chili",
      name: "Big Pot Chili",
      description: "Make extra for tomorrow's lunch.",
      totalTime: "45 min",
      rating: 4.7,
      imageUrl: "/recipes/salmon.jpg",
    },
    {
      id: "salad",
      slug: "kitchen-sink-chopped-salad",
      name: "Kitchen Sink Chopped Salad",
      description: "Whatever is still crisp in the drawer.",
      totalTime: "15 min",
      rating: 4.2,
      imageUrl: "/recipes/pizza.jpg",
    },
  ];
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(q));
}

export function mockRecipeDetail(slug: string): RecipeDetail | null {
  const summary = mockRecipes().find((r) => r.slug === slug);
  if (!summary) return null;
  return {
    ...summary,
    servings: "4",
    ingredients: [
      "1 ½ lb main ingredient",
      "Olive oil, salt, and pepper",
      "1 lemon",
      "Garlic",
      "A vegetable that is already in the fridge",
    ],
    instructions: [
      "Heat the oven or a skillet while you gather ingredients.",
      "Season everything generously.",
      "Cook until it smells like dinner.",
      "Eat at the table if you can swing it.",
    ],
  };
}

export function listStoredEvents(from: string, to: string): CalendarEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM events
       WHERE date(substr(start_iso, 1, 10)) <= date(@to)
         AND date(substr(end_iso, 1, 10)) >= date(@from)
       ORDER BY all_day DESC, start_iso ASC`,
    )
    .all({ from, to }) as EventRow[];
  return rows.map(rowToEvent);
}

export function listStoredMeals(from: string, to: string): MealEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT date, entry_type as entryType, title, recipe_slug as recipeSlug,
              recipe_id as recipeId, image_url as imageUrl
       FROM meals
       WHERE date >= @from AND date <= @to
       ORDER BY date ASC, entry_type ASC`,
    )
    .all({ from, to }) as MealEntry[];
  return rows;
}

export function readWeatherCache(): WeatherPayload | null {
  const row = getDb()
    .prepare("SELECT payload FROM weather_cache WHERE id = 1")
    .get() as { payload: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as WeatherPayload;
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

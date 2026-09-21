export interface Example {
  name: string
  source: string
  stdin: string
}

export const DEFAULT_SOURCE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}
`

export const EXAMPLES: Example[] = [
  { name: 'Hello World', stdin: '', source: DEFAULT_SOURCE },
  {
    name: 'Reading input',
    stdin: 'Aman\n27\n',
    source: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String name = in.nextLine();
        int age = in.nextInt();
        System.out.println(name + " will be " + (age + 1) + " next year.");
    }
}
`,
  },
  {
    name: 'Arrays and loops',
    stdin: '',
    source: `public class Main {
    public static void main(String[] args) {
        int[] numbers = { 5, 3, 9, 1, 7 };
        int sum = 0;
        for (int n : numbers) {
            sum += n;
        }
        System.out.println("sum = " + sum);
        System.out.println("avg = " + (double) sum / numbers.length);
    }
}
`,
  },
  {
    name: 'Collections',
    stdin: '',
    source: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> stock = new LinkedHashMap<>();
        stock.put("apples", 4);
        stock.put("pears", 0);
        stock.put("plums", 12);

        for (Map.Entry<String, Integer> e : stock.entrySet()) {
            System.out.printf("%-8s %d%n", e.getKey(), e.getValue());
        }
    }
}
`,
  },
  {
    name: 'Streams',
    stdin: '',
    source: `import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        List<String> words = List.of("delta", "alpha", "charlie", "bravo");

        String result = words.stream()
                .filter(w -> w.length() > 4)
                .map(String::toUpperCase)
                .sorted()
                .collect(Collectors.joining(", "));

        System.out.println(result);
    }
}
`,
  },
  {
    name: 'A compile error',
    stdin: '',
    source: `public class Main {
    public static void main(String[] args) {
        // This will not compile - that is the point.
        int count = "not a number";
        System.out.println(count);
    }
}
`,
  },
]

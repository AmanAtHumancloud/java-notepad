export const JUDGE0_SUCCESS = {
  stdout: 'Hi Aman\n', time: '0.111', stderr: null, compile_output: null,
  exit_code: 0, message: null, status: { id: 3, description: 'Accepted' },
}

export const JUDGE0_COMPILE_ERROR = {
  stdout: null, time: null, stderr: null,
  compile_output:
    'Main.java:1: error: incompatible types: String cannot be converted to int\n' +
    'public class Main{public static void main(String[] a){int x="oops";}}\n' +
    '                                                            ^\n1 error\n',
  exit_code: null, message: null,
  status: { id: 6, description: 'Compilation Error' },
}

export const JUDGE0_RUNTIME_ERROR = {
  stdout: null, time: '0.032',
  stderr:
    'Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: ' +
    'Index 5 out of bounds for length 1\n\tat Main.main(Main.java:1)\n',
  compile_output: null, exit_code: 1, message: 'Exited with error status 1',
  status: { id: 11, description: 'Runtime Error (NZEC)' },
}

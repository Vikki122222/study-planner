package main

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "all":
		runAll()
	case "back", "backend":
		mustRun("backend", "go", "run", "./cmd/server")
	case "front", "frontend":
		mustRun("frontend", npmCommand(), "run", "dev")
	default:
		printUsage()
		os.Exit(1)
	}
}

func runAll() {
	backend := command("backend", "go", "run", "./cmd/server")
	frontend := command("frontend", npmCommand(), "run", "dev")
	backend.Stdout, backend.Stderr = os.Stdout, os.Stderr
	frontend.Stdout, frontend.Stderr = os.Stdout, os.Stderr

	if err := backend.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "backend start failed: %v\n", err)
		os.Exit(1)
	}
	if err := frontend.Start(); err != nil {
		_ = backend.Process.Kill()
		fmt.Fprintf(os.Stderr, "frontend start failed: %v\n", err)
		os.Exit(1)
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	done := make(chan error, 2)
	go func() { done <- backend.Wait() }()
	go func() { done <- frontend.Wait() }()

	select {
	case <-stop:
		_ = backend.Process.Kill()
		_ = frontend.Process.Kill()
	case err := <-done:
		_ = backend.Process.Kill()
		_ = frontend.Process.Kill()
		if err != nil {
			fmt.Fprintf(os.Stderr, "process stopped: %v\n", err)
		}
	}
}

func mustRun(dir, name string, args ...string) {
	cmd := command(dir, name, args...)
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "%s failed: %v\n", name, err)
		os.Exit(1)
	}
}

func command(dir, name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	return cmd
}

func npmCommand() string {
	if runtime.GOOS == "windows" {
		return "npm.cmd"
	}
	return "npm"
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run . all    # backend + frontend")
	fmt.Println("  go run . back   # only backend")
	fmt.Println("  go run . front  # only frontend")
}

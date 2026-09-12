use std::{env, path::PathBuf};
use corelia_tasks::{add_task, complete_task, load_tasks, save_tasks};

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    let path = PathBuf::from(env::var("CORELIA_TASK_FILE").unwrap_or_else(|_| "tasks.tsv".into()));
    let mut tasks = load_tasks(&path)?;
    match args.first().map(String::as_str) {
        Some("add") if args.len() >= 2 => {
            let id = add_task(&mut tasks, &args[1..].join(" "))?;
            save_tasks(&path, &tasks)?;
            println!("Added task {id}");
        }
        Some("list") if args.len() == 1 => {
            for task in tasks {
                println!("{} [{}] {}", task.id, if task.done { "x" } else { " " }, task.title);
            }
        }
        Some("done") if args.len() == 2 => {
            let id = args[1].parse::<u64>().map_err(|_| "Expected a numeric task ID")?;
            complete_task(&mut tasks, id)?;
            save_tasks(&path, &tasks)?;
            println!("Completed task {id}");
        }
        _ => return Err("Usage: corelia-tasks add <title> | list | done <id>".into()),
    }
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
